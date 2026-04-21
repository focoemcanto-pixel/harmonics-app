import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdminFromRequest } from '@/lib/api/require-admin';
import { deleteInvitesByIds } from '@/lib/invites/delete-invites';

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdminFromRequest({ supabase, request, logPrefix: '[INVITES_DELETE_MANY]' });
    if (!auth.ok) return NextResponse.json(auth, { status: auth.status || 401 });

    const body = await request.json().catch(() => ({}));
    const inviteIds = Array.isArray(body?.inviteIds) ? body.inviteIds : [];

    if (inviteIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'Selecione ao menos um convite.' }, { status: 400 });
    }

    const result = await deleteInvitesByIds({ supabase, inviteIds });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || 'Erro ao excluir convites.' }, { status: 500 });
  }
}
