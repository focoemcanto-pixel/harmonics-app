function normalizeFeatureKey(feature) {
  return String(feature || '').trim();
}

function resolveFeatureColumn(feature) {
  const key = normalizeFeatureKey(feature);
  const map = {
    automation: 'can_use_automation',
    contracts: 'can_use_contracts',
    whatsapp: 'can_use_whatsapp',
    white_label: 'can_use_white_label',
  };

  return map[key] || null;
}

function resolveLimitColumn(limitKey) {
  const key = normalizeFeatureKey(limitKey);
  const map = {
    members: 'max_members',
    events_per_month: 'max_events_per_month',
    whatsapp_messages: 'max_whatsapp_messages',
  };

  return map[key] || null;
}

function resolveUsageEventType(limitKey) {
  const key = normalizeFeatureKey(limitKey);
  const map = {
    events_per_month: 'event_created',
    whatsapp_messages: 'whatsapp_message_sent',
  };

  return map[key] || null;
}

function startOfCurrentMonthIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString();
}

export async function getWorkspacePlan({ supabase, workspaceId }) {
  const resolvedWorkspaceId = String(workspaceId || '').trim();
  if (!supabase || !resolvedWorkspaceId) {
    return { ok: false, error: 'workspaceId é obrigatório.' };
  }

  const { data, error } = await supabase
    .from('workspace_subscriptions')
    .select(`
      id,
      workspace_id,
      status,
      current_period_start,
      current_period_end,
      expires_at,
      plan:workspace_plans (*)
    `)
    .eq('workspace_id', resolvedWorkspaceId)
    .in('status', ['active', 'trialing', 'past_due', 'paused'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[PLAN_ENFORCEMENT][PLAN_LOOKUP_FAILED]', {
      message: error.message,
      code: error.code || null,
      workspaceId: resolvedWorkspaceId,
    });
    return { ok: false, error: error.message };
  }

  if (!data?.plan) {
    return { ok: false, error: 'Workspace sem plano ativo.', code: 'NO_ACTIVE_PLAN' };
  }

  return {
    ok: true,
    subscription: data,
    plan: data.plan,
  };
}

export async function checkWorkspaceFeature({ supabase, workspaceId, feature }) {
  const planResult = await getWorkspacePlan({ supabase, workspaceId });
  if (!planResult.ok) return { allowed: false, ...planResult };

  const column = resolveFeatureColumn(feature);
  if (!column) {
    return { allowed: false, ok: false, error: `Feature desconhecida: ${feature}` };
  }

  const allowed = Boolean(planResult.plan?.[column]);

  return {
    ok: true,
    allowed,
    feature,
    column,
    plan: planResult.plan,
    subscription: planResult.subscription,
    error: allowed ? null : 'Recurso indisponível no plano atual.',
    code: allowed ? null : 'FEATURE_NOT_ALLOWED',
  };
}

async function countMembers({ supabase, workspaceId }) {
  const { count, error } = await supabase
    .from('workspace_members')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  if (error) throw error;
  return Number(count || 0);
}

async function sumUsage({ supabase, workspaceId, eventType, since }) {
  const { data, error } = await supabase
    .from('usage_events')
    .select('quantity')
    .eq('workspace_id', workspaceId)
    .eq('event_type', eventType)
    .gte('occurred_at', since);

  if (error) throw error;

  return (data || []).reduce((acc, row) => acc + Number(row?.quantity || 0), 0);
}

export async function checkWorkspaceLimit({ supabase, workspaceId, limitKey, increment = 1 }) {
  const resolvedWorkspaceId = String(workspaceId || '').trim();
  const planResult = await getWorkspacePlan({ supabase, workspaceId: resolvedWorkspaceId });
  if (!planResult.ok) return { allowed: false, ...planResult };

  const limitColumn = resolveLimitColumn(limitKey);
  if (!limitColumn) {
    return { allowed: false, ok: false, error: `Limite desconhecido: ${limitKey}` };
  }

  const limitValue = planResult.plan?.[limitColumn];

  // null significa ilimitado.
  if (limitValue === null || limitValue === undefined) {
    return {
      ok: true,
      allowed: true,
      limitKey,
      limitColumn,
      limit: null,
      used: 0,
      remaining: null,
      plan: planResult.plan,
      subscription: planResult.subscription,
    };
  }

  const limit = Number(limitValue);
  const inc = Number(increment || 1);

  let used = 0;

  if (limitKey === 'members') {
    used = await countMembers({ supabase, workspaceId: resolvedWorkspaceId });
  } else {
    const eventType = resolveUsageEventType(limitKey);
    if (!eventType) {
      return { allowed: false, ok: false, error: `Evento de uso não mapeado para limite: ${limitKey}` };
    }
    used = await sumUsage({
      supabase,
      workspaceId: resolvedWorkspaceId,
      eventType,
      since: planResult.subscription?.current_period_start || startOfCurrentMonthIso(),
    });
  }

  const nextUsed = used + inc;
  const allowed = nextUsed <= limit;

  return {
    ok: true,
    allowed,
    limitKey,
    limitColumn,
    limit,
    used,
    increment: inc,
    nextUsed,
    remaining: Math.max(limit - used, 0),
    plan: planResult.plan,
    subscription: planResult.subscription,
    error: allowed ? null : 'Limite do plano atingido.',
    code: allowed ? null : 'PLAN_LIMIT_REACHED',
  };
}

export async function requireWorkspaceFeature(args) {
  const result = await checkWorkspaceFeature(args);
  if (!result.allowed) {
    const error = new Error(result.error || 'Recurso indisponível no plano atual.');
    error.code = result.code || 'FEATURE_NOT_ALLOWED';
    error.statusCode = 402;
    error.details = result;
    throw error;
  }
  return result;
}

export async function requireWorkspaceLimit(args) {
  const result = await checkWorkspaceLimit(args);
  if (!result.allowed) {
    const error = new Error(result.error || 'Limite do plano atingido.');
    error.code = result.code || 'PLAN_LIMIT_REACHED';
    error.statusCode = 402;
    error.details = result;
    throw error;
  }
  return result;
}
