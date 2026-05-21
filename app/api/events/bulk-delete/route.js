import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { deleteEventsCascade } from '@/lib/events/delete-event-cascade';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';

function uniqIds(list = []) {
  return Array.from(new Set(list.map((id) => String(id || '').trim()).filter(Boolean)));
}

async function filterWorkspaceEventIds({ supabase, eventIds, workspaceId }) {
  const ids = uniqIds(eventIds);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('events')
    .select('id')
    .eq('workspace_id', workspaceId)
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
      moduleKey: 'events',
      actionKey: 'write',
      logPrefix: '[EVENT_BULK_DELETE_API]',
    });

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, success: false, error: auth.error || 'Acesso não autorizado.' },
        { status: auth.status || 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const requestedEventIds = uniqIds(Array.isArray(body?.eventIds) ? body.eventIds : []);

    console.info('[EVENT_BULK_DELETE_API][DELETE][TABLE]', { table: 'events (+ dependências)' });
    console.info('[EVENT_BULK_DELETE_API][DELETE][IDS]', {
      requestedEventIds,
      workspaceId: auth.workspaceId,
    });

    if (requestedEventIds.length === 0) {
      return NextResponse.json(
        { ok: false, success: false, error: 'Selecione ao menos um evento para excluir.' },
        { status: 400 }
      );
    }

    const eventIds = await filterWorkspaceEventIds({
      supabase,
      eventIds: requestedEventIds,
      workspaceId: auth.workspaceId,
    });

    if (eventIds.length === 0) {
      return NextResponse.json(
        { ok: false, success: false, error: 'Nenhum evento válido encontrado neste workspace.' },
        { status: 404 }
      );
    }

    const summary = await deleteEventsCascade({
      supabase,
      eventIds,
      logPrefix: '[EVENT_BULK_DELETE_API]',
    });

    const deletedItems = Array.isArray(summary?.success) ? summary.success : [];
    const failedItems = Array.isArray(summary?.failed) ? summary.failed : [];
    const deletedIds = deletedItems.map((item) => String(item?.eventId || '')).filter(Boolean);
    const failedIds = failedItems.map((item) => String(item?.eventId || '')).filter(Boolean);

    console.info('[EVENT_BULK_DELETE_API][DELETE][RESULT]', {
      requested: summary.requested,
      success: deletedItems.length,
      failed: failedItems.length,
      deletedIds,
      failedIds,
    });

    return NextResponse.json({
      ok: true,
      success: true,
      requested: summary.requested,
      affected: deletedIds.length,
      deleted: deletedIds.length,
      failedCount: failedItems.length,
      ids: deletedIds,
      deletedIds,
      failedIds,
      failed: failedItems,
      items: deletedItems,
      message:
        failedItems.length > 0
          ? `${deletedIds.length} evento(s) excluído(s). ${failedItems.length} falharam.`
          : `${deletedIds.length} evento(s) excluído(s) com sucesso.`,
    });
  } catch (error) {
    console.error('[EVENT_BULK_DELETE_API][DELETE][ERROR]', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

    return NextResponse.json(
      {
        ok: false,
        success: false,
        error: error?.message || 'Erro inesperado na exclusão em massa.',
      },
      { status: 500 }
    );
  }
}
