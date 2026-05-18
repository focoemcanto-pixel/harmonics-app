import { getSupabaseAdmin } from '@/lib/supabase-admin';

function normalizeText(value) {
  return String(value || '').trim();
}

function isMissingColumnError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();

  return (
    code === '42703' ||
    message.includes('does not exist') ||
    message.includes('could not find') ||
    details.includes('schema cache')
  );
}

function slugify(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `workspace-${Date.now()}`;
}

async function createUniqueWorkspaceSlug({ supabase, baseName }) {
  const baseSlug = slugify(baseName);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    const slug = `${baseSlug}${suffix}`.slice(0, 72);

    let response = await supabase
      .from('workspaces')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (response.error && isMissingColumnError(response.error)) {
      response = await supabase
        .from('workspaces')
        .select('id')
        .eq('key', slug)
        .maybeSingle();
    }

    if (response.error) throw response.error;
    if (!response.data?.id) return slug;
  }

  return `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`.slice(0, 72);
}

async function insertWorkspace({ supabase, name, slug }) {
  const payload = {
    name,
    slug,
    key: slug,
    status: 'active',
    plan_key: 'free',
  };

  let { data, error } = await supabase
    .from('workspaces')
    .insert(payload)
    .select('*')
    .single();

  if (error && isMissingColumnError(error)) {
    const legacyPayload = {
      name,
      key: slug,
      is_active: true,
    };

    const legacy = await supabase
      .from('workspaces')
      .insert(legacyPayload)
      .select('*')
      .single();

    data = legacy.data;
    error = legacy.error;
  }

  if (error) throw error;
  return data;
}

async function ensureOwnerMembership({ supabase, workspaceId, userId }) {
  const resolvedWorkspaceId = normalizeText(workspaceId);
  const resolvedUserId = normalizeText(userId);

  if (!resolvedWorkspaceId || !resolvedUserId) {
    throw new Error('workspaceId e userId são obrigatórios para criar owner membership.');
  }

  let existingResponse = await supabase
    .from('workspace_members')
    .select('id, role, status')
    .eq('workspace_id', resolvedWorkspaceId)
    .eq('user_id', resolvedUserId)
    .maybeSingle();

  if (existingResponse.error && isMissingColumnError(existingResponse.error)) {
    existingResponse = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', resolvedWorkspaceId)
      .eq('user_id', resolvedUserId)
      .maybeSingle();
  }

  if (existingResponse.error) throw existingResponse.error;

  if (existingResponse.data?.id) {
    let updateResponse = await supabase
      .from('workspace_members')
      .update({ role: 'owner', status: 'active' })
      .eq('id', existingResponse.data.id)
      .select('*')
      .single();

    if (updateResponse.error && isMissingColumnError(updateResponse.error)) {
      updateResponse = await supabase
        .from('workspace_members')
        .update({ role: 'owner' })
        .eq('id', existingResponse.data.id)
        .select('*')
        .single();
    }

    if (updateResponse.error) throw updateResponse.error;
    return updateResponse.data;
  }

  let insertResponse = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: resolvedWorkspaceId,
      user_id: resolvedUserId,
      role: 'owner',
      status: 'active',
    })
    .select('*')
    .single();

  if (insertResponse.error && isMissingColumnError(insertResponse.error)) {
    insertResponse = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: resolvedWorkspaceId,
        user_id: resolvedUserId,
        role: 'owner',
      })
      .select('*')
      .single();
  }

  if (insertResponse.error) throw insertResponse.error;
  return insertResponse.data;
}

async function ensureWorkspaceSettings({ supabase, workspace, options = {} }) {
  const workspaceId = workspace?.id;
  if (!workspaceId) throw new Error('workspace.id é obrigatório para criar settings.');

  const { data: existing, error: existingError } = await supabase
    .from('workspace_settings')
    .select('id')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return existing;

  const publicName = normalizeText(options.publicName) || workspace.name;
  const supportWhatsapp = normalizeText(options.supportWhatsapp) || null;
  const primaryColor = normalizeText(options.primaryColor) || null;

  const payload = {
    workspace_id: workspaceId,
    workspace_key: workspace.slug || workspace.key || null,
    company_name: publicName,
    public_name: publicName,
    support_whatsapp: supportWhatsapp,
    admin_whatsapp: supportWhatsapp,
    default_timezone: options.timezone || 'America/Bahia',
    is_active: true,
    contract_mode: 'internal',
    settings: {
      onboarding: {
        completed: false,
        source: options.source || 'workspace_bootstrap',
      },
      brand: {
        primary_color: primaryColor,
      },
    },
  };

  const { data, error } = await supabase
    .from('workspace_settings')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function bootstrapWorkspaceForUser({
  supabase: suppliedSupabase = null,
  userId,
  workspaceName,
  publicName = null,
  supportWhatsapp = null,
  primaryColor = null,
  timezone = 'America/Bahia',
  source = 'public_signup',
} = {}) {
  const supabase = suppliedSupabase || getSupabaseAdmin();
  const resolvedUserId = normalizeText(userId);
  const resolvedWorkspaceName = normalizeText(workspaceName) || 'Novo Workspace';

  if (!resolvedUserId) {
    throw new Error('userId é obrigatório para bootstrap do workspace.');
  }

  const slug = await createUniqueWorkspaceSlug({
    supabase,
    baseName: resolvedWorkspaceName,
  });

  const workspace = await insertWorkspace({
    supabase,
    name: resolvedWorkspaceName,
    slug,
  });

  const ownerMembership = await ensureOwnerMembership({
    supabase,
    workspaceId: workspace.id,
    userId: resolvedUserId,
  });

  const settings = await ensureWorkspaceSettings({
    supabase,
    workspace,
    options: {
      publicName,
      supportWhatsapp,
      primaryColor,
      timezone,
      source,
    },
  });

  // A subscription FREE é criada por trigger no banco.
  const { data: subscription } = await supabase
    .from('workspace_subscriptions')
    .select('*, plan:workspace_plans(*)')
    .eq('workspace_id', workspace.id)
    .in('status', ['active', 'trialing', 'past_due', 'paused'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    ok: true,
    workspace,
    ownerMembership,
    settings,
    subscription: subscription || null,
  };
}
