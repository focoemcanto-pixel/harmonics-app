import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { deleteScalesCascade } from '@/lib/scales/delete-scales-cascade';

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
      moduleKey: 'scales',
      actionKey: 'write',
      logPrefix: '[SCALES_DELETE_SINGLE]',
    });

    if (!auth.ok) {
      return NextResponse.json(auth, { status: auth.status || 401 });
    }

    const body = await request.json().catch(() => ({}));
    const payloadIds = [
      body?.eventId,
      ...(Array.isArray(body?.eventIds) ? body.eventIds : []),
      body?.id,
    ];
    const requestedEventIds = uniqIds(payloadIds);

    console.log('[ESCALAS_DELETE][SINGLE_PAYLOAD]', { requestedEventIds, workspaceId: auth.workspaceId });

    if (requestedEventIds.length !== 1) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          affected: 0,
          message: 'Informe exatamente uma escala para exclusão individual.',
        },
        { status: 400 }
      );
    }

    const eventIds = await filterWorkspaceEventIds({
      supabase,
      eventIds: requestedEventIds,
      workspaceId: auth.workspaceId,
    });

    if (eventIds.length !== 1) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          affected: 0,
          ids: [],
          message: 'Escala não encontrada neste workspace.',
        },
        { status: 404 }
      );
    }

    const result = await deleteScalesCascade({ supabase, eventIds });
    console.log('[ESCALAS_DELETE][SINGLE_RESULT]', result);

    if (Number(result.affected || 0) === 0 || !Array.isArray(result.deletedEventIds) || result.deletedEventIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          affected: 0,
          ids: [],
          message: result?.failed?.[0]?.error || 'Nenhuma escala correspondente foi encontrada para exclusão.',
          ...result,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      success: true,
      affected: result.affected,
      ids: result.deletedEventIds,
      requested: result.requested,
      failed: result.failed,
      message: 'Escala excluída com sucesso.',
    });
  } catch (error) {
    console.error('[SCALES_DELETE_SINGLE][DELETE][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      {
        ok: false,
        success: false,
        affected: 0,
        message: error?.message || 'Erro ao excluir escala.',
      },
      { status: 500 }
    );
  }
}
