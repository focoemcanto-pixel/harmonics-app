import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess, requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';
import { requireAdminFromRequest } from '@/lib/api/require-admin';

// Guards de rota com resposta pronta. Padrão de uso:
//   const guard = await guardWorkspaceAdmin(request, { logPrefix: '[X]' });
//   if (!guard.ok) return guard.response;
//   const { auth, supabase } = guard;
// A autorização sempre deriva de SESSÃO → USUÁRIO → MEMBERSHIP → WORKSPACE; nunca de
// workspace_id enviado pelo cliente.

function deny(status, error) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function guardWorkspaceMember(request, { logPrefix = '[GUARD][MEMBER]', supabase } = {}) {
  const client = supabase || getSupabaseAdmin();
  const auth = await requireWorkspaceAccess({ supabase: client, request, logPrefix });
  if (!auth.ok) return { ok: false, response: deny(auth.status || 401, auth.error) };
  return { ok: true, auth, supabase: client };
}

export async function guardWorkspaceAdmin(request, { logPrefix = '[GUARD][WORKSPACE_ADMIN]', supabase } = {}) {
  const client = supabase || getSupabaseAdmin();
  const auth = await requireWorkspaceAdmin({ supabase: client, request, logPrefix });
  if (!auth.ok) return { ok: false, response: deny(auth.status || 401, auth.error) };
  return { ok: true, auth, supabase: client };
}

export async function guardPlatformAdmin(request, { logPrefix = '[GUARD][PLATFORM_ADMIN]', supabase } = {}) {
  const client = supabase || getSupabaseAdmin();
  const auth = await requireAdminFromRequest({ supabase: client, request, logPrefix });
  if (!auth.ok) return { ok: false, response: deny(auth.status || 401, auth.error) };
  return { ok: true, auth, supabase: client };
}

function timingSafeEqualString(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

// Chamadas máquina-a-máquina: exige INTERNAL_API_KEY no header x-internal-key.
// Sem a variável configurada, nenhuma chamada interna é aceita (falha fechada).
export function isInternalRequest(request) {
  const expected = String(process.env.INTERNAL_API_KEY || '').trim();
  const received = String(request?.headers?.get('x-internal-key') || '').trim();
  return timingSafeEqualString(received, expected);
}

// Rotas sem consumidor no app: aceitam chamada interna autenticada OU admin do workspace.
export async function guardInternalOrWorkspaceAdmin(request, options = {}) {
  if (isInternalRequest(request)) {
    return { ok: true, internal: true, auth: null, supabase: options.supabase || getSupabaseAdmin() };
  }
  const guard = await guardWorkspaceAdmin(request, options);
  if (!guard.ok) {
    console.warn(`${options.logPrefix || '[GUARD]'}[REJECTED]`, { reason: 'not_internal_nor_workspace_admin' });
  }
  return guard;
}

// Confirma que a linha `id` de `table` pertence ao workspace autenticado.
// Retorna 404 (não 403) para não revelar a existência de IDs de outros tenants.
export async function assertRowInWorkspace({ supabase, table, id, workspaceId, column = 'workspace_id' }) {
  const rowId = String(id || '').trim();
  if (!rowId || !workspaceId) return { ok: false, response: deny(404, 'Registro não encontrado.') };

  const { data, error } = await supabase
    .from(table)
    .select(`id, ${column}`)
    .eq('id', rowId)
    .maybeSingle();

  if (error) {
    console.error('[GUARD][ROW_LOOKUP_ERROR]', { table, code: error.code, message: error.message });
    return { ok: false, response: deny(500, 'Falha ao validar o registro.') };
  }

  if (!data?.id || String(data[column] || '') !== String(workspaceId)) {
    return { ok: false, response: deny(404, 'Registro não encontrado.') };
  }

  return { ok: true, row: data };
}

// Para tabelas filhas sem workspace_id (invites, event_musicians, ...): valida via evento.
export async function assertEventInWorkspace({ supabase, eventId, workspaceId }) {
  return assertRowInWorkspace({ supabase, table: 'events', id: eventId, workspaceId });
}

// Rotas de diagnóstico: invisíveis (404) em produção, exceto com ENABLE_DEBUG_ROUTES=true
// e sessão de admin de plataforma.
export async function guardDebugRoute(request) {
  if (String(process.env.ENABLE_DEBUG_ROUTES || '').toLowerCase() !== 'true') {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 }) };
  }
  return guardPlatformAdmin(request, { logPrefix: '[GUARD][DEBUG]' });
}
