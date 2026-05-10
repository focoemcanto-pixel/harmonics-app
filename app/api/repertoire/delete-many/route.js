import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { deleteRepertoiresCascade } from '@/lib/repertorio/delete-repertoires-cascade';

function normalizePayloadIds(body = {}) {
  return [
    ...(Array.isArray(body?.eventIds) ? body.eventIds : []),
    ...(Array.isArray(body?.event_ids) ? body.event_ids : []),
    ...(Array.isArray(body?.ids) ? body.ids : []),
  ];
}

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
      moduleKey: 'repertorios',
      actionKey: 'write',
      logPrefix: '[REPERTOIRE_DELETE_MANY_API]',
    });

    if (!auth.ok) {
      return NextResponse.json(auth, { status: auth.status || 401 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedEventIds = uniqIds(normalizePayloadIds(body));

    console.log('[REPERTOIRE_DELETE][PAYLOAD]', body);
    console.info('[REPERTOIRE_DELETE_MANY_API][DELETE][IDS]', {
      requestedEventIds,
      workspaceId: auth.workspaceId,
    });

    if (requestedEventIds.length === 0) {
      return NextResponse.json(
        { success: false, ok: false, affected: 0, message: 'Selecione ao menos um repertório.' },
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
        {
          success: false,
          ok: false,
          affected: 0,
          ids: [],
          message: 'Nenhum repertório válido encontrado neste workspace.',
        },
        { status: 404 }
      );
    }

    const result = await deleteRepertoiresCascade({ supabase, eventIds });
    console.log('[REPERTOIRE_DELETE][RESULT]', result);

    if (!result.success || Number(result.affected || 0) === 0) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          affected: 0,
          ids: [],
          message: result.message || 'Nenhum repertório correspondente foi encontrado para exclusão.',
          ...result,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ok: true,
      affected: result.deletedEventIds.length,
      ids: result.deletedEventIds,
      message: result.message || `${result.deletedEventIds.length} repertório(s) excluído(s) com sucesso.`,
      ...result,
    });
  } catch (error) {
    console.error('[REPERTOIRE_DELETE_MANY_API][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      {
        success: false,
        ok: false,
        affected: 0,
        message: error?.message || 'Erro ao excluir repertórios.',
      },
      { status: 500 }
    );
  }
}
