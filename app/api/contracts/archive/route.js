import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { assertRowInWorkspace, guardInternalOrWorkspaceAdmin } from '@/lib/api/route-guards';

async function updateStatusById(supabase, table, id, status) {
  const { error } = await supabase
    .from(table)
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw new Error(`[${table}] ${error.message}`);
  }
}

export async function POST(request) {
  const guard = await guardInternalOrWorkspaceAdmin(request, { logPrefix: '[POST /api/contracts/archive]' });
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const precontractId = String(body?.precontractId || '').trim();
    const contractId = String(body?.contractId || '').trim() || null;

    if (!precontractId) {
      return NextResponse.json(
        { ok: false, error: 'precontractId é obrigatório.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    if (!guard.internal) {
      const workspaceId = guard.auth.workspaceId;
      const preCheck = await assertRowInWorkspace({ supabase, table: 'precontracts', id: precontractId, workspaceId });
      if (!preCheck.ok) return preCheck.response;
      if (contractId) {
        const contractCheck = await assertRowInWorkspace({ supabase, table: 'contracts', id: contractId, workspaceId });
        if (!contractCheck.ok) return contractCheck.response;
      }
    }

    await updateStatusById(supabase, 'precontracts', precontractId, 'cancelled');

    if (contractId) {
      await updateStatusById(supabase, 'contracts', contractId, 'cancelled');
    }

    return NextResponse.json({
      ok: true,
      archived: true,
      statusApplied: 'cancelled',
      precontractId,
      contractId,
    });
  } catch (error) {
    console.error('[CONTRACTS_ARCHIVE] erro', {
      message: error?.message,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao remover contrato.' },
      { status: 500 }
    );
  }
}
