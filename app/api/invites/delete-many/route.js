import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { deleteInvitesByIds } from '@/lib/invites/delete-invites';

function uniqIds(list = []) {
  return Array.from(new Set(list.map((id) => String(id || '').trim()).filter(Boolean)));
}

async function filterWorkspaceInviteIds({ supabase, inviteIds, workspaceId }) {
  const ids = uniqIds(inviteIds);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('invites')
    .select('id, event:events!inner(id, workspace_id)')
    .eq('event.workspace_id', workspaceId)
    .in('id', ids);

  if (error) throw error;
  return uniqIds((data || []).map((row) => row.id));
}

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      moduleKey: 'convites',
      actionKey: 'write',
      logPrefix: '[INVITES_DELETE_MANY]',
    });

    if (!auth.ok) {
      return NextResponse.json(auth, { status: auth.status || 401 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedInviteIds = uniqIds(Array.isArray(body?.inviteIds) ? body.inviteIds : []);

    console.info('[INVITES_DELETE_MANY][DELETE][TABLE]', { table: 'event_musicians/invites' });
    console.info('[INVITES_DELETE_MANY][DELETE][IDS]', {
      requestedInviteIds,
      workspaceId: auth.workspaceId,
    });

    if (requestedInviteIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'Selecione ao menos um convite.' }, { status: 400 });
    }

    const inviteIds = await filterWorkspaceInviteIds({
      supabase,
      inviteIds: requestedInviteIds,
      workspaceId: auth.workspaceId,
    });

    if (inviteIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Nenhum convite válido encontrado neste workspace.' },
        { status: 404 }
      );
    }

    const result = await deleteInvitesByIds({ supabase, inviteIds });

    console.info('[INVITES_DELETE_MANY][DELETE][RESULT]', {
      requested: result.requested,
      success: result.success.length,
      failed: result.failed.length,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      success: true,
      deleted: result.success.length,
      failedCount: result.failed.length,
    });
  } catch (error) {
    console.error('[INVITES_DELETE_MANY][DELETE][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao excluir convites.' },
      { status: 500 }
    );
  }
}
