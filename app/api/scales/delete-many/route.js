import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { deleteScalesCascade } from '@/lib/scales/delete-scales-cascade';

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[SCALES_DELETE_MANY]' });
    if (!auth.ok) return NextResponse.json(auth, { status: auth.status || 401 });

    const body = await request.json().catch(() => ({}));
    console.log('[ESCALAS_DELETE][BODY]', body);

    const directEventIds = [
      ...(Array.isArray(body?.eventIds) ? body.eventIds : []),
      ...(Array.isArray(body?.event_ids) ? body.event_ids : []),
      ...(Array.isArray(body?.ids) ? body.ids : []),
    ];
    const scaleIds = Array.isArray(body?.scaleIds) ? body.scaleIds : [];
    const inviteIds = Array.isArray(body?.inviteIds) ? body.inviteIds : [];
    const eventIdsSet = new Set(directEventIds.map((id) => String(id || '').trim()).filter(Boolean));

    if (scaleIds.length > 0) {
      const { data: scaleRows, error: scaleError } = await supabase
        .from('event_musicians')
        .select('event_id')
        .in('id', scaleIds);
      if (scaleError) throw scaleError;
      (scaleRows || []).forEach((row) => eventIdsSet.add(String(row.event_id || '').trim()));
    }

    if (inviteIds.length > 0) {
      const { data: inviteRows, error: inviteError } = await supabase
        .from('invites')
        .select('event_id')
        .in('id', inviteIds);
      if (inviteError) throw inviteError;
      (inviteRows || []).forEach((row) => eventIdsSet.add(String(row.event_id || '').trim()));
    }

    const eventIds = Array.from(eventIdsSet).filter(Boolean);

    console.info('[SCALES_DELETE_MANY][DELETE][TABLE]', { table: 'event_musicians, invites' });
    console.info('[SCALES_DELETE_MANY][DELETE][IDS]', { eventIds });
    console.log('[ESCALAS_DELETE][MATCH_QUERY]', {
      table: ['event_musicians', 'invites'],
      column: 'event_id',
      eventIds,
      sourceKeys: {
        eventIds: directEventIds.length,
        scaleIds: scaleIds.length,
        inviteIds: inviteIds.length,
      },
    });

    if (eventIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'Selecione ao menos uma escala.' }, { status: 400 });
    }

    const result = await deleteScalesCascade({ supabase, eventIds });
    console.log('[ESCALAS_DELETE][RESULT]', result);

    console.info('[SCALES_DELETE_MANY][DELETE][RESULT]', {
      requested: result.requested,
      success: result.success.length,
      failed: result.failed.length,
      affected: result.affected,
    });

    if (Number(result.affected || 0) === 0) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          affected: 0,
          ids: [],
          message: 'Nenhuma escala correspondente foi encontrada para exclusão.',
          ...result,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      success: true,
      affected: result.affected,
      ids: result.deletedEventIds || [],
      message: `${result.deletedEventIds?.length || 0} escala(s) excluída(s).`,
      ...result,
      deleted: result.success.length,
      failedCount: result.failed.length,
    });
  } catch (error) {
    console.error('[SCALES_DELETE_MANY][DELETE][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });
    return NextResponse.json({ ok: false, error: error?.message || 'Erro ao excluir escalas.' }, { status: 500 });
  }
}
