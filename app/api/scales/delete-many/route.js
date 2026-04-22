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
    const eventIds = Array.isArray(body?.eventIds) ? body.eventIds : [];

    console.info('[SCALES_DELETE_MANY][DELETE][TABLE]', { table: 'event_musicians, invites' });
    console.info('[SCALES_DELETE_MANY][DELETE][IDS]', { eventIds });

    if (eventIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'Selecione ao menos uma escala.' }, { status: 400 });
    }

    const result = await deleteScalesCascade({ supabase, eventIds });

    console.info('[SCALES_DELETE_MANY][DELETE][RESULT]', {
      requested: result.requested,
      success: result.success.length,
      failed: result.failed.length,
    });

    return NextResponse.json({ ok: true, ...result, success: true, deleted: result.success.length, failedCount: result.failed.length });
  } catch (error) {
    console.error('[SCALES_DELETE_MANY][DELETE][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });
    return NextResponse.json({ ok: false, error: error?.message || 'Erro ao excluir escalas.' }, { status: 500 });
  }
}
