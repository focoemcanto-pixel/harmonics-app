import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const body = await request.json();
    const precontractId = String(body?.precontractId || '').trim();
    const contractId = String(body?.contractId || '').trim() || null;

    console.info('[CONTRACTS_ARCHIVE] payload recebido', {
      precontractId,
      contractId,
    });

    if (!precontractId) {
      return NextResponse.json(
        { ok: false, error: 'precontractId é obrigatório.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    console.info('[CONTRACTS_ARCHIVE] executando operação', {
      operation: 'soft_delete',
      precontracts: { id: precontractId, status: 'archived' },
      contracts: contractId ? { id: contractId, status: 'archived' } : null,
    });

    const { error: preError } = await supabase
      .from('precontracts')
      .update({
        status: 'archived',
        updated_at: nowIso,
      })
      .eq('id', precontractId);

    if (preError) throw preError;

    if (contractId) {
      const { error: contractError } = await supabase
        .from('contracts')
        .update({
          status: 'archived',
          updated_at: nowIso,
        })
        .eq('id', contractId);

      if (contractError) throw contractError;
    }

    console.info('[CONTRACTS_ARCHIVE] sucesso', {
      precontractId,
      contractId,
    });

    return NextResponse.json({
      ok: true,
      archived: true,
      precontractId,
      contractId,
    });
  } catch (error) {
    console.error('[CONTRACTS_ARCHIVE] erro', {
      message: error?.message,
    });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao arquivar contrato.' },
      { status: 500 }
    );
  }
}
