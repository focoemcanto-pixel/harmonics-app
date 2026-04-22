import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { deleteScalesCascade } from '@/lib/scales/delete-scales-cascade';

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[SCALES_DELETE_SINGLE]' });
    if (!auth.ok) return NextResponse.json(auth, { status: auth.status || 401 });

    const body = await request.json().catch(() => ({}));
    const payloadIds = [
      body?.eventId,
      ...(Array.isArray(body?.eventIds) ? body.eventIds : []),
      body?.id,
    ];
    const eventIds = Array.from(new Set(payloadIds.map((id) => String(id || '').trim()).filter(Boolean)));

    console.log('[ESCALAS_DELETE][SINGLE_PAYLOAD]', { eventIds });

    if (eventIds.length !== 1) {
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
