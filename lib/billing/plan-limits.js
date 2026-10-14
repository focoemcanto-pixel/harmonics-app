import { resolveEffectivePlan } from '@/lib/billing/subscription-state';

// Limites de plano aplicados NO BACKEND. O frontend apenas informa.
// Interruptor de emergência: ENFORCE_WORKSPACE_PLANS=false desliga o bloqueio (só registra).

function enforcementEnabled() {
  return String(process.env.ENFORCE_WORKSPACE_PLANS ?? 'true').toLowerCase() !== 'false';
}

function startOfMonthIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function loadWorkspaceBilling({ supabase, workspaceId }) {
  const [{ data: workspace }, { data: subscription }, { data: freePlan }] = await Promise.all([
    supabase.from('workspaces').select('id, plan_key').eq('id', workspaceId).maybeSingle(),
    supabase
      .from('workspace_subscriptions')
      .select('*, plan:workspace_plans(*)')
      .eq('workspace_id', workspaceId)
      .in('status', ['active', 'trialing', 'past_due', 'paused'])
      .maybeSingle(),
    supabase.from('workspace_plans').select('*').eq('slug', 'free').maybeSingle(),
  ]);

  const effective = resolveEffectivePlan({ subscription, plan: subscription?.plan || null, freePlan, workspace });
  return { workspace, subscription, freePlan, effectivePlan: effective.plan, effectiveReason: effective.reason };
}

const LIMITS = {
  events_per_month: {
    column: 'max_events_per_month',
    label: 'eventos por mês',
    count: async ({ supabase, workspaceId }) => {
      const { count } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('created_at', startOfMonthIso());
      return Number(count || 0);
    },
  },
  members: {
    column: 'max_members',
    label: 'membros da equipe',
    count: async ({ supabase, workspaceId }) => {
      const { count } = await supabase
        .from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', 'active');
      return Number(count || 0);
    },
  },
};

/**
 * Retorna { ok: true } ou { ok: false, status: 402, code: 'PLAN_LIMIT_REACHED', error, limit, used }.
 * Falhas ao consultar o plano não bloqueiam a operação (fail-open registrado): a indisponibilidade
 * do billing não pode parar a operação de quem já usa o sistema.
 */
export async function checkPlanLimit({ supabase, workspaceId, limitKey, increment = 1 }) {
  const definition = LIMITS[limitKey];
  if (!definition) throw new Error(`Limite desconhecido: ${limitKey}`);

  try {
    const billing = await loadWorkspaceBilling({ supabase, workspaceId });
    const plan = billing.effectivePlan;
    if (!plan || plan.unlimited) return { ok: true, unlimited: true };

    const limit = plan[definition.column];
    if (limit === null || limit === undefined) return { ok: true, unlimited: true };

    const used = await definition.count({ supabase, workspaceId });
    if (used + increment <= Number(limit)) return { ok: true, limit: Number(limit), used };

    const blocked = {
      ok: false,
      status: 402,
      code: 'PLAN_LIMIT_REACHED',
      error: `Seu plano ${plan.name || plan.slug} permite ${limit} ${definition.label}. Faça upgrade para continuar.`,
      limitKey,
      limit: Number(limit),
      used,
      plan: plan.slug,
    };

    if (!enforcementEnabled()) {
      console.warn('[PLAN_LIMIT][SOFT]', { workspaceId, limitKey, limit, used });
      return { ok: true, soft: true, wouldBlock: blocked };
    }

    console.warn('[PLAN_LIMIT][BLOCKED]', { workspaceId, limitKey, limit, used, plan: plan.slug });
    return blocked;
  } catch (error) {
    console.error('[PLAN_LIMIT][CHECK_FAILED_OPEN]', { workspaceId, limitKey, message: error?.message });
    return { ok: true, checkFailed: true };
  }
}
