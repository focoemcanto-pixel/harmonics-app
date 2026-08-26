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

export async function requireScheduleManagerAccess({ supabase, request, logPrefix = '[SCHEDULE_MANAGER]' } = {}) {
  const admin = await requireWorkspaceAdmin({ supabase, request, logPrefix });
  if (admin.ok) {
    return { ...admin, delegatedScheduleManager: false };
  }

  const { user, error } = await resolveUser({ supabase, request });
  const email = String(user?.email || '').trim().toLowerCase();
  if (error || !user?.id || !email) {
    return { ok: false, status: 401, error: 'Sessão expirada. Faça login novamente.' };
  }

  const { data: contacts, error: contactError } = await supabase
    .from('contacts')
    .select('id, workspace_id, name, email, is_active, can_view_all_events, can_manage_schedules')
    .ilike('email', email)
    .eq('is_active', true)
    .eq('can_manage_schedules', true)
    .limit(10);

  if (contactError) {
    console.error(`${logPrefix}[CONTACT_PERMISSION_ERROR]`, {
      message: contactError.message,
      code: contactError.code,
    });
    return { ok: false, status: 500, error: 'Não foi possível validar a permissão de escala.' };
  }

  const requestedWorkspaceId =
    String(request?.headers?.get('x-workspace-id') || request?.cookies?.get?.('workspace_id')?.value || '').trim();

  const eligible = (contacts || []).filter(
    (row) => row?.can_manage_schedules === true && row?.can_view_all_events === true && row?.workspace_id
  );

  const contact = requestedWorkspaceId
    ? eligible.find((row) => String(row.workspace_id) === requestedWorkspaceId)
    : eligible[0];

  if (!contact?.id) {
    return { ok: false, status: 403, error: 'Você não possui permissão para montar escalas.' };
  }

  return {
    ok: true,
    userId: user.id,
    email,
    workspaceId: contact.workspace_id,
    contact,
    role: 'schedule_manager',
    canAdminWorkspace: false,
    delegatedScheduleManager: true,
  };
}
