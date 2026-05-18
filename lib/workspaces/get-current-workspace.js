import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const DEFAULT_WORKSPACE_SLUG =
  process.env.DEFAULT_WORKSPACE_SLUG || 'harmonics-producao';

const DEFAULT_WORKSPACE_KEY =
  process.env.DEFAULT_WORKSPACE_KEY || 'default';

const WORKSPACE_SELECT = 'id, name, slug, key, status, plan_key';
const WORKSPACE_SELECT_LEGACY = 'id, name, key, is_active';
const PROFILE_SELECT_WITH_WORKSPACE =
  'id, role, is_admin, workspace_id, current_workspace_id, default_workspace_id';
const PROFILE_SELECT_ADMIN_LEGACY = 'id, role, is_admin';
const PROFILE_SELECT_ROLE_LEGACY = 'id, role';
const MEMBER_SELECT = 'id, workspace_id, user_id, role, status, created_at, updated_at';
const MEMBER_SELECT_NO_DATES = 'id, workspace_id, user_id, role, status';
const MEMBER_SELECT_MINIMAL = 'id, workspace_id, user_id, role';

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

function normalizeRole(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isLegacyProfileAdmin(profile) {
  const role = normalizeRole(profile?.role);
  return profile?.is_admin === true || role === 'admin' || role === 'administrador';
}

function normalizeWorkspaceRow(row) {
  if (!row?.id) return null;

  return {
    ...row,
    slug: row.slug || row.key || null,
    key: row.key || row.slug || null,
    status: row.status || (row.is_active === false ? 'inactive' : 'active'),
    plan_key: row.plan_key || null,
  };
}

function createCookieSupabaseClient(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !request?.cookies?.getAll) {
    return null;
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // App Router API helpers in this project only need to read the session here.
      },
    },
  });
}

async function resolveUserFromRequest({ supabase, request }) {
  const authHeader = String(request?.headers?.get('authorization') || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    return { source: 'bearer', user: data?.user || null, error: error || null };
  }

  const cookieSupabase = createCookieSupabaseClient(request);
  if (!cookieSupabase) {
    return { source: 'none', user: null, error: null };
  }

  const { data, error } = await cookieSupabase.auth.getUser();
  return { source: 'cookie', user: data?.user || null, error: error || null };
}

function getRequestWorkspaceId(request) {
  const headerValue =
    request?.headers?.get('x-workspace-id') ||
    request?.headers?.get('x-current-workspace-id') ||
    request?.headers?.get('x-harmonics-workspace-id') ||
    '';

  if (String(headerValue || '').trim()) return String(headerValue).trim();

  const cookieValue =
    request?.cookies?.get?.('workspace_id')?.value ||
    request?.cookies?.get?.('current_workspace_id')?.value ||
    request?.cookies?.get?.('harmonics_workspace_id')?.value ||
    '';

  if (String(cookieValue || '').trim()) return String(cookieValue).trim();

  try {
    const url = request?.url ? new URL(request.url) : null;
    return String(url?.searchParams?.get('workspace_id') || '').trim() || null;
  } catch {
    return null;
  }
}

async function fetchWorkspaceById({ supabase, workspaceId }) {
  if (!workspaceId) return null;

  let response = await supabase
    .from('workspaces')
    .select(WORKSPACE_SELECT)
    .eq('id', workspaceId)
    .maybeSingle();

  if (response.error && isMissingColumnError(response.error)) {
    response = await supabase
      .from('workspaces')
      .select(WORKSPACE_SELECT_LEGACY)
      .eq('id', workspaceId)
      .maybeSingle();
  }

  if (response.error) {
    throw new Error(`Erro ao buscar workspace por id: ${response.error.message}`);
  }

  return normalizeWorkspaceRow(response.data);
}

async function fetchDefaultWorkspace(client) {
  const attempts = [
    { select: WORKSPACE_SELECT, column: 'slug', value: DEFAULT_WORKSPACE_SLUG },
    { select: WORKSPACE_SELECT, column: 'slug', value: DEFAULT_WORKSPACE_KEY },
    { select: WORKSPACE_SELECT, column: 'key', value: DEFAULT_WORKSPACE_KEY },
    { select: WORKSPACE_SELECT, column: 'key', value: DEFAULT_WORKSPACE_SLUG },
    { select: WORKSPACE_SELECT_LEGACY, column: 'key', value: DEFAULT_WORKSPACE_KEY },
    { select: WORKSPACE_SELECT_LEGACY, column: 'key', value: DEFAULT_WORKSPACE_SLUG },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    const { data, error } = await client
      .from('workspaces')
      .select(attempt.select)
      .eq(attempt.column, attempt.value)
      .maybeSingle();

    if (!error && data?.id) return normalizeWorkspaceRow(data);

    if (error && !isMissingColumnError(error)) {
      lastError = error;
    }
  }

  const { data: firstActive, error: firstActiveError } = await client
    .from('workspaces')
    .select(WORKSPACE_SELECT_LEGACY)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!firstActiveError && firstActive?.id) return normalizeWorkspaceRow(firstActive);
  if (firstActiveError && !isMissingColumnError(firstActiveError)) lastError = firstActiveError;

  throw new Error(
    lastError?.message
      ? `Erro ao buscar workspace padrão: ${lastError.message}`
      : `Workspace padrão não encontrado: ${DEFAULT_WORKSPACE_SLUG}`
  );
}

export async function getDefaultWorkspace({ supabase } = {}) {
  const client = supabase || getSupabaseAdmin();
  return fetchDefaultWorkspace(client);
}

export async function getWorkspaceSettings({ supabase, workspaceId }) {
  const client = supabase || getSupabaseAdmin();

  if (!workspaceId) {
    throw new Error('workspaceId é obrigatório para buscar settings.');
  }

  const { data, error } = await client
    .from('workspace_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error && isMissingColumnError(error)) {
    const { data: legacyData, error: legacyError } = await client
      .from('workspace_settings')
      .select('*')
      .eq('id', workspaceId)
      .maybeSingle();

    if (legacyError) {
      throw new Error(`Erro ao buscar configurações do workspace: ${legacyError.message}`);
    }

    return legacyData || null;
  }

  if (error) {
    throw new Error(`Erro ao buscar configurações do workspace: ${error.message}`);
  }

  if (data) return data;

  const { data: legacyData, error: legacyError } = await client
    .from('workspace_settings')
    .select('*')
    .eq('id', workspaceId)
    .maybeSingle();

  if (legacyError) {
    throw new Error(`Erro ao buscar configurações do workspace: ${legacyError.message}`);
  }

  return legacyData || null;
}

async function getProfile({ supabase, userId }) {
  if (!userId) return null;

  let response = await supabase
    .from('profiles')
    .select(PROFILE_SELECT_WITH_WORKSPACE)
    .eq('id', userId)
    .maybeSingle();

  if (response.error && isMissingColumnError(response.error)) {
    response = await supabase
      .from('profiles')
      .select(PROFILE_SELECT_ADMIN_LEGACY)
      .eq('id', userId)
      .maybeSingle();
  }

  if (response.error && isMissingColumnError(response.error)) {
    response = await supabase
      .from('profiles')
      .select(PROFILE_SELECT_ROLE_LEGACY)
      .eq('id', userId)
      .maybeSingle();
  }

  if (response.error) {
    console.warn('[WORKSPACE_CONTEXT][PROFILE]', {
      message: response.error?.message,
      code: response.error?.code,
    });
    return null;
  }

  return response.data || null;
}

async function runMemberQueryAttempts({ attempts, label }) {
  let lastError = null;

  for (const buildQuery of attempts) {
    const response = await buildQuery();

    if (!response?.error) return response?.data || null;

    lastError = response.error;
    if (!isMissingColumnError(response.error)) break;
  }

  if (lastError) {
    console.warn(`[WORKSPACE_CONTEXT][${label}]`, {
      message: lastError?.message,
      code: lastError?.code,
    });
  }

  return null;
}

async function getMembershipForWorkspace({ supabase, userId, workspaceId }) {
  if (!userId || !workspaceId) return null;

  return runMemberQueryAttempts({
    label: 'MEMBER_BY_WORKSPACE',
    attempts: [
      () => supabase
        .from('workspace_members')
        .select(MEMBER_SELECT)
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle(),
      () => supabase
        .from('workspace_members')
        .select(MEMBER_SELECT_NO_DATES)
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle(),
      () => supabase
        .from('workspace_members')
        .select(MEMBER_SELECT_MINIMAL)
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .maybeSingle(),
    ],
  });
}

async function getFirstActiveMembership({ supabase, userId }) {
  if (!userId) return null;

  return runMemberQueryAttempts({
    label: 'MEMBER_FIRST_ACTIVE',
    attempts: [
      () => supabase
        .from('workspace_members')
        .select(MEMBER_SELECT)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      () => supabase
        .from('workspace_members')
        .select(MEMBER_SELECT_NO_DATES)
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle(),
      () => supabase
        .from('workspace_members')
        .select(MEMBER_SELECT_MINIMAL)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle(),
    ],
  });
}

async function buildWorkspaceContext({ supabase, workspaceId, member = null, profile = null, source }) {
  const workspace = (await fetchWorkspaceById({ supabase, workspaceId }).catch((error) => {
    console.warn('[WORKSPACE_CONTEXT][WORKSPACE]', {
      workspaceId,
      message: error?.message,
    });
    return null;
  })) || { id: workspaceId, name: null, slug: null, key: null, status: 'active', plan_key: null };

  if (!workspace?.id) return null;

  const settings = await getWorkspaceSettings({ supabase, workspaceId: workspace.id }).catch((error) => {
    console.warn('[WORKSPACE_CONTEXT][SETTINGS]', {
      workspaceId: workspace.id,
      message: error?.message,
    });
    return null;
  });

  return {
    workspaceId: workspace.id,
    workspace,
    settings,
    role: normalizeRole(member?.role || profile?.role || 'owner') || 'owner',
    isPlatformAdmin: isLegacyProfileAdmin(profile),
    member,
    source,
  };
}

export async function getCurrentWorkspace({ supabase, request } = {}) {
  const client = supabase || getSupabaseAdmin();
  const authResult = await resolveUserFromRequest({ supabase: client, request });
  const userId = authResult.user?.id || null;
  const profile = await getProfile({ supabase: client, userId });
  const requestedWorkspaceId = getRequestWorkspaceId(request);

  if (userId && requestedWorkspaceId) {
    const member = await getMembershipForWorkspace({
      supabase: client,
      userId,
      workspaceId: requestedWorkspaceId,
    });

    if (member?.workspace_id || isLegacyProfileAdmin(profile)) {
      const requestedContext = await buildWorkspaceContext({
        supabase: client,
        workspaceId: requestedWorkspaceId,
        member,
        profile,
        source: member?.workspace_id ? 'request_workspace_member' : 'request_workspace_profile_admin',
      });

      if (requestedContext) return requestedContext;
    }
  }

  if (userId) {
    const profileWorkspaceId =
      profile?.current_workspace_id || profile?.workspace_id || profile?.default_workspace_id || null;

    if (profileWorkspaceId) {
      const profileMember = await getMembershipForWorkspace({
        supabase: client,
        userId,
        workspaceId: profileWorkspaceId,
      });

      if (profileMember?.workspace_id || isLegacyProfileAdmin(profile)) {
        const profileContext = await buildWorkspaceContext({
          supabase: client,
          workspaceId: profileWorkspaceId,
          member: profileMember,
          profile,
          source: profileMember?.workspace_id ? 'profiles_workspace_member' : 'profiles_workspace_profile_admin',
        });

        if (profileContext) return profileContext;
      }
    }

    const member = await getFirstActiveMembership({ supabase: client, userId });

    if (member?.workspace_id) {
      const memberContext = await buildWorkspaceContext({
        supabase: client,
        workspaceId: member.workspace_id,
        member,
        profile,
        source: 'workspace_members',
      });

      if (memberContext) return memberContext;
    }
  }

  if (userId) {
    return null;
  }

  const workspace = await getDefaultWorkspace({ supabase: client });
  const settings = await getWorkspaceSettings({
    supabase: client,
    workspaceId: workspace.id,
  }).catch(() => null);

  return {
    workspaceId: workspace.id,
    workspace,
    settings,
    role: isLegacyProfileAdmin(profile) ? normalizeRole(profile?.role) || 'admin' : 'owner',
    isPlatformAdmin: true,
    member: null,
    source: userId ? 'default_workspace_fallback' : 'default_workspace_no_auth_fallback',
  };
}
