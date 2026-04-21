import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { deleteEventCascade } from '@/lib/events/delete-event-cascade';

export async function DELETE(_request, { params }) {
  const supabase = getSupabaseAdmin();
  const routeParams = await params;
  const eventId = String(routeParams?.id || '').trim();

  console.info('[EVENT_DELETE_API][INPUT]', { eventId });

  try {
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

    return NextResponse.json({
      ok: true,
      deletedId: result.deletedId,
      cleanup: result.cleanup,
    });
  } catch (error) {
    console.error('[EVENT_DELETE_API][ERROR]', {
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
