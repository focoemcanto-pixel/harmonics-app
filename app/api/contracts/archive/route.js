import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

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
