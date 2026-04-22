import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { deleteInvitesByIds } from '@/lib/invites/delete-invites';

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[INVITES_DELETE_MANY]' });
    if (!auth.ok) return NextResponse.json(auth, { status: auth.status || 401 });

    const body = await request.json().catch(() => ({}));
    const inviteIds = Array.isArray(body?.inviteIds) ? body.inviteIds : [];

    console.info('[INVITES_DELETE_MANY][DELETE][TABLE]', { table: 'event_musicians' });
    console.info('[INVITES_DELETE_MANY][DELETE][IDS]', { inviteIds });

    if (inviteIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'Selecione ao menos um convite.' }, { status: 400 });
    }

    const result = await deleteInvitesByIds({ supabase, inviteIds });

    console.info('[INVITES_DELETE_MANY][DELETE][RESULT]', {
      requested: result.requested,
      success: result.success.length,
      failed: result.failed.length,
    });

    return NextResponse.json({ ok: true, ...result, success: true, deleted: result.success.length, failedCount: result.failed.length });
  } catch (error) {
    console.error('[INVITES_DELETE_MANY][DELETE][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });
    return NextResponse.json({ ok: false, error: error?.message || 'Erro ao excluir convites.' }, { status: 500 });
  }
}
