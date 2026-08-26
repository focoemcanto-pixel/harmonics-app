import { createServerClient } from '@supabase/ssr';
import { requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';

function createCookieClient(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon || !request?.cookies?.getAll) return null;
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {},
    },
  });
}

async function resolveUser({ supabase, request }) {
  const authHeader = String(request?.headers?.get('authorization') || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    return { user: data?.user || null, error: error || null };
  }

  const cookieClient = createCookieClient(request);
  if (!cookieClient) return { user: null, error: null };
  const { data, error } = await cookieClient.auth.getUser();
  return { user: data?.user || null, error: error || null };
}

function requestedWorkspaceIdFromRequest(request) {
  return String(
    request?.headers?.get('x-workspace-id') ||
      request?.headers?.get('x-current-workspace-id') ||
      request?.cookies?.get?.('workspace_id')?.value ||
      request?.cookies?.get?.('current_workspace_id')?.value ||
      ''
  ).trim();
}

async function requireDelegatedContactPermission({
  supabase,
  request,
  logPrefix,
  requireManage = false,
}) {
  const admin = await requireWorkspaceAdmin({ supabase, request, logPrefix });
  if (admin.ok) {
    return {
      ...admin,
      delegatedScheduleManager: false,
      delegatedAgendaViewer: false,
    };
  }

  const { user, error } = await resolveUser({ supabase, request });
  const email = String(user?.email || '').trim().toLowerCase();
  if (error || !user?.id || !email) {
    return { ok: false, status: 401, error: 'Sessão expirada. Faça login novamente.' };
  }

  let query = supabase
    .from('contacts')
    .select('id, workspace_id, name, email, is_active, can_view_all_events, can_manage_schedules')
    .ilike('email', email)
    .eq('is_active', true);

  query = requireManage
    ? query.eq('can_manage_schedules', true)
    : query.eq('can_view_all_events', true);

  const { data: contacts, error: contactError } = await query.limit(10);

  if (contactError) {
    console.error(`${logPrefix}[CONTACT_PERMISSION_ERROR]`, {
      message: contactError.message,
      code: contactError.code,
    });
    return {
      ok: false,
      status: 500,
      error: requireManage
        ? 'Não foi possível validar a permissão de escala.'
        : 'Não foi possível validar a permissão de agenda.',
    };
  }

  const requestedWorkspaceId = requestedWorkspaceIdFromRequest(request);
  const eligible = (contacts || []).filter((row) => {
    if (!row?.workspace_id) return false;
    if (requireManage) {
      return row.can_manage_schedules === true && row.can_view_all_events === true;
    }
    return row.can_view_all_events === true || row.can_manage_schedules === true;
  });

  // Prefer the workspace explicitly sent by the member panel. A stale workspace cookie
  // must not invalidate a unique delegated permission that was already resolved by e-mail.
  const requestedMatch = requestedWorkspaceId
    ? eligible.find((row) => String(row.workspace_id) === requestedWorkspaceId)
    : null;
  const contact = requestedMatch || (eligible.length === 1 ? eligible[0] : null);

  if (!contact?.id) {
    console.warn(`${logPrefix}[CONTACT_PERMISSION_DENIED]`, {
      email,
      requestedWorkspaceId: requestedWorkspaceId || null,
      eligibleWorkspaceIds: eligible.map((row) => row.workspace_id),
      requireManage,
    });
    return {
      ok: false,
      status: 403,
      error: requireManage
        ? 'Você não possui permissão para montar escalas.'
        : 'Você não possui permissão para visualizar a agenda global.',
    };
  }

  return {
    ok: true,
    userId: user.id,
    email,
    workspaceId: contact.workspace_id,
    contact,
    role: requireManage ? 'schedule_manager' : 'agenda_viewer',
    canAdminWorkspace: false,
    delegatedScheduleManager: requireManage,
    delegatedAgendaViewer: true,
  };
}

export async function requireMemberAgendaAccess({
  supabase,
  request,
  logPrefix = '[MEMBER_AGENDA_ACCESS]',
} = {}) {
  return requireDelegatedContactPermission({
    supabase,
    request,
    logPrefix,
    requireManage: false,
  });
}

export async function requireScheduleManagerAccess({
  supabase,
  request,
  logPrefix = '[SCHEDULE_MANAGER]',
} = {}) {
  return requireDelegatedContactPermission({
    supabase,
    request,
    logPrefix,
    requireManage: true,
  });
}
