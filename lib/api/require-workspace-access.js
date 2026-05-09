import { createServerClient } from '@supabase/ssr';
import { getCurrentWorkspace } from '@/lib/workspaces/get-current-workspace';

const ADMIN_ROLES = new Set(['owner', 'admin', 'administrador']);

function normalizeRole(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
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
        // API guards only read the current session. They must not mutate cookies here.
      },
    },
  });
}

async function resolveUserFromRequest({ supabase, request, logPrefix }) {
  const authHeader = String(request?.headers?.get('authorization') || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (token) {
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    return {
      source: 'bearer',
      user: userData?.user || null,
      error: userError || null,
    };
  }

  const cookieSupabase = createCookieSupabaseClient(request);

  if (!cookieSupabase) {
    console.warn(`${logPrefix}[AUTH][COOKIE_CLIENT]`, { message: 'cookie_client_unavailable' });
    return { source: 'cookie', user: null, error: null };
  }

  const { data: userData, error: userError } = await cookieSupabase.auth.getUser();

  return {
    source: 'cookie',
    user: userData?.user || null,
    error: userError || null,
  };
}

export async function requireWorkspaceAccess({
  supabase,
  request,
  logPrefix = '[WORKSPACE_GUARD]',
  allowedRoles = [],
  requireAdmin = false,
} = {}) {
  const authResult = await resolveUserFromRequest({ supabase, request, logPrefix });

  if (authResult.error || !authResult.user?.id) {
    console.warn(`${logPrefix}[AUTH][USER]`, {
      source: authResult.source,
      message: authResult.error?.message || 'missing_user',
    });
    return { ok: false, status: 401, error: 'Sessão expirada. Faça login novamente.' };
  }

  const workspaceContext = await getCurrentWorkspace({ supabase, request });
  const workspaceId = workspaceContext?.workspaceId;

  if (!workspaceId) {
    return { ok: false, status: 500, error: 'Workspace atual não resolvido.' };
  }

  const { data: member, error: memberError } = await supabase
    .from('workspace_members')
    .select('id, workspace_id, user_id, role, status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', authResult.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (memberError) {
    console.error(`${logPrefix}[MEMBER][ERROR]`, {
      message: memberError?.message,
      code: memberError?.code,
      details: memberError?.details,
    });
    return { ok: false, status: 500, error: 'Falha ao validar acesso ao workspace.' };
  }

  if (!member?.id) {
    return { ok: false, status: 403, error: 'Usuário não pertence a este workspace.' };
  }

  const role = normalizeRole(member.role);
  const allowed = allowedRoles.map(normalizeRole).filter(Boolean);
  const isWorkspaceAdmin = ADMIN_ROLES.has(role);

  if (requireAdmin && !isWorkspaceAdmin) {
    return { ok: false, status: 403, error: 'Apenas administradores do workspace podem executar esta ação.' };
  }

  if (allowed.length > 0 && !allowed.includes(role)) {
    return { ok: false, status: 403, error: 'Permissão insuficiente para esta ação.' };
  }

  return {
    ok: true,
    userId: authResult.user.id,
    email: authResult.user.email || null,
    workspaceId,
    workspace: workspaceContext.workspace || null,
    settings: workspaceContext.settings || null,
    member,
    role,
    isWorkspaceAdmin,
    source: authResult.source,
  };
}

export async function requireWorkspaceAdmin(params = {}) {
  return requireWorkspaceAccess({ ...params, requireAdmin: true });
}
