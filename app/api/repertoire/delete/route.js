import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { deleteRepertoiresCascade } from '@/lib/repertorio/delete-repertoires-cascade';

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[REPERTOIRE_DELETE_ONE_API]' });
    if (!auth.ok) return NextResponse.json(auth, { status: auth.status || 401 });

    const body = await request.json().catch(() => ({}));
    const eventId = String(body?.eventId || body?.id || '').trim();

    console.log('[REPERTOIRE_DELETE][PAYLOAD]', body);

    if (!eventId) {
      return NextResponse.json(
        { success: false, ok: false, affected: 0, message: 'eventId é obrigatório.' },
        { status: 400 }
      );
    }

    const result = await deleteRepertoiresCascade({ supabase, eventIds: [eventId] });
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
    console.error('[REPERTOIRE_DELETE_ONE_API][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      {
        success: false,
        ok: false,
        affected: 0,
        message: error?.message || 'Erro ao excluir repertório.',
      },
      { status: 500 }
    );
  }
}
