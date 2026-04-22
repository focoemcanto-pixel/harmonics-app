import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { deleteContractsCascade } from '@/lib/contracts/delete-contracts-cascade';

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[CONTRACT_DELETE_MANY]' });
    if (!auth.ok) return NextResponse.json(auth, { status: auth.status || 401 });

    const body = await request.json().catch(() => ({}));
    const precontractIds = Array.isArray(body?.precontractIds) ? body.precontractIds : [];

    console.info('[CONTRACT_DELETE_MANY][DELETE][TABLE]', { table: 'precontracts, contracts' });
    console.info('[CONTRACT_DELETE_MANY][DELETE][IDS]', { precontractIds });

    if (precontractIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'Selecione ao menos um contrato.' }, { status: 400 });
    }

    const result = await deleteContractsCascade({ supabase, precontractIds });

    console.info('[CONTRACT_DELETE_MANY][DELETE][RESULT]', {
      requested: result.requested,
      success: result.success.length,
      failed: result.failed.length,
    });

    return NextResponse.json({ ok: true, ...result, success: true, deleted: result.success.length, failedCount: result.failed.length });
  } catch (error) {
    console.error('[CONTRACT_DELETE_MANY][DELETE][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });
    return NextResponse.json({ ok: false, error: error?.message || 'Erro ao excluir contratos.' }, { status: 500 });
  }
}
