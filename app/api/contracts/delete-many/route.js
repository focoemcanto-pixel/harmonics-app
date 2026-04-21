import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdminFromRequest } from '@/lib/api/require-admin';
import { deleteContractsCascade } from '@/lib/contracts/delete-contracts-cascade';

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdminFromRequest({ supabase, request, logPrefix: '[CONTRACT_DELETE_MANY]' });
    if (!auth.ok) return NextResponse.json(auth, { status: auth.status || 401 });

    const body = await request.json().catch(() => ({}));
    const precontractIds = Array.isArray(body?.precontractIds) ? body.precontractIds : [];

    if (precontractIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'Selecione ao menos um contrato.' }, { status: 400 });
    }

    const result = await deleteContractsCascade({ supabase, precontractIds });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || 'Erro ao excluir contratos.' }, { status: 500 });
  }
}
