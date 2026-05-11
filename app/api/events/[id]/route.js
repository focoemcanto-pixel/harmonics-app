import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { deleteEventCascade } from '@/lib/events/delete-event-cascade';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';

async function eventBelongsToWorkspace({ supabase, eventId, workspaceId }) {
  const { data, error } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

export async function DELETE(request, context) {
  const supabase = getSupabaseAdmin();
  const routeParams = await context?.params;
  const eventId = String(routeParams?.id || '').trim();

  console.info('[EVENT_DELETE_API][DELETE][START]', { mode: 'single' });
  console.info('[EVENT_DELETE_API][DELETE][TABLE]', { table: 'events (+ dependências)' });
  console.info('[EVENT_DELETE_API][DELETE][IDS]', { eventIds: [eventId] });

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      moduleKey: 'events',
      actionKey: 'write',
      logPrefix: '[EVENT_DELETE_API]',
    });

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error || 'Acesso não autorizado.' },
        { status: auth.status || 401 }
      );
    }

    if (!eventId) {
      return NextResponse.json({ ok: false, error: 'ID do evento é obrigatório.' }, { status: 400 });
    }

    const canDeleteEvent = await eventBelongsToWorkspace({
      supabase,
      eventId,
      workspaceId: auth.workspaceId,
    });

    if (!canDeleteEvent) {
      return NextResponse.json(
        { ok: false, error: 'Evento não encontrado neste workspace.' },
        { status: 404 }
      );
    }

    const result = await deleteEventCascade({
      supabase,
      eventId,
      logPrefix: '[EVENT_DELETE_API]',
    });

    if (!result?.ok) {
      return NextResponse.json(
        { ok: false, error: result?.error || 'Falha ao excluir evento.' },
        { status: result?.status || 500 }
      );
    }

    console.info('[EVENT_DELETE_API][DELETE][RESULT]', {
      requested: 1,
      success: result?.deletedId ? 1 : 0,
      failed: result?.deletedId ? 0 : 1,
    });

    return NextResponse.json({
      ok: true,
      success: true,
      deleted: result?.deletedId ? 1 : 0,
      failed: result?.deletedId ? 0 : 1,
      deletedId: result.deletedId,
      cleanup: result.cleanup,
    });
  } catch (error) {
    console.error('[EVENT_DELETE_API][DELETE][ERROR]', {
      eventId,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Erro inesperado ao excluir evento no servidor.',
      },
      { status: 500 }
    );
  }
}
