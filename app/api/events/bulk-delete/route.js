import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { deleteEventsCascade } from '@/lib/events/delete-event-cascade';
import { requireAdminFromRequest } from '@/lib/api/require-admin';

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdminFromRequest({ supabase, request, logPrefix: '[EVENT_BULK_DELETE_API]' });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    }

    const body = await request.json().catch(() => ({}));
    const eventIds = Array.isArray(body?.eventIds) ? body.eventIds : [];

    console.info('[EVENT_BULK_DELETE_API][REQUEST_START]', {
      requestedCount: eventIds.length,
    });

    if (eventIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Selecione ao menos um evento para excluir.' },
        { status: 400 }
      );
    }

    const summary = await deleteEventsCascade({
      supabase,
      eventIds,
      logPrefix: '[EVENT_BULK_DELETE_API]',
    });

    return NextResponse.json({
      ok: true,
      ...summary,
    });
  } catch (error) {
    console.error('[EVENT_BULK_DELETE_API][ERROR]', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Erro inesperado na exclusão em massa.',
      },
      { status: 500 }
    );
  }
}
