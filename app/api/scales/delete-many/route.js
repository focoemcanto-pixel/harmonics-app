import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdminFromRequest } from '@/lib/api/require-admin';
import { deleteScalesCascade } from '@/lib/scales/delete-scales-cascade';

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdminFromRequest({ supabase, request, logPrefix: '[SCALES_DELETE_MANY]' });
    if (!auth.ok) return NextResponse.json(auth, { status: auth.status || 401 });

    const body = await request.json().catch(() => ({}));
    const eventIds = Array.isArray(body?.eventIds) ? body.eventIds : [];

    if (eventIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'Selecione ao menos uma escala.' }, { status: 400 });
    }

    const result = await deleteScalesCascade({ supabase, eventIds });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || 'Erro ao excluir escalas.' }, { status: 500 });
  }
}
