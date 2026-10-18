import { createServerClient } from '@supabase/ssr';
import { getCurrentWorkspace } from '@/lib/workspaces/get-current-workspace';
import { attachAuthContext } from '@/lib/observability/api-observability';
import { getUserFromCookieSession } from '@/lib/auth/cookie-access-token';

const ADMIN_ROLES = new Set(['owner', 'admin', 'administrador']);
const MEMBER_SELECT = 'id, workspace_id, user_id, role, status';
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

  // Só valida o token do cookie: renovar aqui descartaria os tokens novos (ver lib/auth/cookie-access-token).
  const { user: cookieUser, error: userError } = await getUserFromCookieSession(cookieSupabase, request);

  return {
    source: 'cookie',
    user: cookieUser,
    error: userError || null,
  };
}

async function getProfileRole({ supabase, userId }) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[WORKSPACE_GUARD][PROFILE_ROLE]', {
      message: error?.message,
      code: error?.code,
    });
    return null;
  }

  return normalizeRole(data?.role);
}

// Contato ativo de músico/equipe (não cliente) com este e-mail em algum workspace.
export async function isActiveMemberContact({ supabase, email }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('id')
      .ilike('email', normalized.replace(/[\\%_]/g, (char) => `\\${char}`))
      .neq('is_active', false)
      // Contratantes (clientes) não contam: só músicos/equipe usam o portal do membro.
      .or('contact_type.is.null,contact_type.neq.client')
      .limit(1);
    return !error && Array.isArray(data) && data.length > 0;
  } catch {
    // Só orienta o redirecionamento; em falha, mantém o comportamento anterior (acesso já negado).
    return false;
  }
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

  const workspaceContext = await getCurrentWorkspace({ supabase, request, user: authResult.user });
  const workspaceId = workspaceContext?.workspaceId;

  if (!workspaceId) {
    // NO_WORKSPACE (que leva o painel para /workspace/new) só quando está confirmado que o
    // usuário não tem nenhuma membership. Erro de consulta ou membership existente → código
    // neutro, sem redirecionar quem já opera em um workspace.
    const membershipCheck = await supabase
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', authResult.user.id);
    const confirmedWithoutWorkspace = !membershipCheck?.error && Number(membershipCheck?.count || 0) === 0;
    // Músico/membro (contato ativo com este e-mail) sem membership administrativa: o acesso
    // continua negado; o código só orienta o front a levá-lo ao portal /membro, nunca ao
    // cadastro de workspace.
    if (confirmedWithoutWorkspace && (await isActiveMemberContact({ supabase, email: authResult.user.email }))) {
      return {
        ok: false,
        status: 403,
        code: 'MEMBER_ONLY',
        error: 'Esta conta acessa o Harmonics pelo painel do membro.',
      };
    }
    return {
      ok: false,
      status: 403,
      code: confirmedWithoutWorkspace ? 'NO_WORKSPACE' : 'WORKSPACE_UNRESOLVED',
      error: 'Workspace ativo não resolvido para o usuário autenticado.',
    };
  }

  if (workspaceContext?.workspace?.status && String(workspaceContext.workspace.status).toLowerCase() !== 'active') {
    return { ok: false, status: 403, error: 'Workspace inativo não pode ser acessado.' };
  }

  // Reaproveita perfil e membership já carregados pelo contexto (mesmos filtros); só
  // consulta de novo quando o contexto não os trouxe.
  const contextProfileLoaded = Object.prototype.hasOwnProperty.call(workspaceContext || {}, 'profile');
  const profileRole = contextProfileLoaded
    ? normalizeRole(workspaceContext.profile?.role)
    : await getProfileRole({ supabase, userId: authResult.user.id });
  const isLegacyProfileAdmin = profileRole === 'owner' || profileRole === 'admin' || profileRole === 'administrador';

  const contextMember = workspaceContext?.member;
  const contextMemberMatches =
    contextMember?.id &&
    String(contextMember.workspace_id || '') === String(workspaceId) &&
    String(contextMember.user_id || '') === String(authResult.user.id) &&
    (contextMember.status === undefined || String(contextMember.status).toLowerCase() === 'active');

  let memberResponse = contextMemberMatches
    ? { data: contextMember, error: null }
    : await supabase
    .from('workspace_members')
    .select(MEMBER_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('user_id', authResult.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (memberResponse.error && isMissingColumnError(memberResponse.error)) {
    memberResponse = await supabase
      .from('workspace_members')
      .select(MEMBER_SELECT_MINIMAL)
      .eq('workspace_id', workspaceId)
      .eq('user_id', authResult.user.id)
      .maybeSingle();
  }

  const member = memberResponse.data || null;
  const memberError = memberResponse.error || null;

  if (memberError) {
    console.error(`${logPrefix}[MEMBER][ERROR]`, {
      message: memberError?.message,
      code: memberError?.code,
      details: memberError?.details,
    });
    return { ok: false, status: 500, error: 'Falha ao validar acesso ao workspace.' };
  }

  if (!member?.id && !isLegacyProfileAdmin) {
    return { ok: false, status: 403, error: 'Usuário não pertence a este workspace.' };
  }

  const role = normalizeRole(member?.role || workspaceContext.role || profileRole || 'viewer');
  const allowed = allowedRoles.map(normalizeRole).filter(Boolean);
  const isWorkspaceAdmin = ADMIN_ROLES.has(role);
  const canAdminWorkspace = isWorkspaceAdmin || isLegacyProfileAdmin;

  if (requireAdmin && !canAdminWorkspace) {
    console.warn(`${logPrefix}[ADMIN][DENIED]`, {
      user_id: authResult.user.id,
      workspace_id: workspaceId,
      member_role: role,
      profile_role: profileRole,
      source: authResult.source,
    });
    return { ok: false, status: 403, error: 'Apenas administradores do workspace podem executar esta ação.' };
  }

  if (allowed.length > 0 && !allowed.includes(role) && !canAdminWorkspace) {
    return { ok: false, status: 403, error: 'Permissão insuficiente para esta ação.' };
  }

  attachAuthContext(request, { userId: authResult.user.id, workspaceId, role });

  return {
    ok: true,
    userId: authResult.user.id,
    email: authResult.user.email || null,
    workspaceId,
    workspace: workspaceContext.workspace || null,
    settings: workspaceContext.settings || null,
    member,
    role,
    profileRole,
    isWorkspaceAdmin,
    isLegacyProfileAdmin,
    canAdminWorkspace,
    source: authResult.source,
  };
}

export async function requireWorkspaceAdmin(params = {}) {
  return requireWorkspaceAccess({ ...params, requireAdmin: true });
}
