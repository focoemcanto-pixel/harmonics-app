import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function isMissingUpdatedAtColumn(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('updated_at') && (
    message.includes('column') ||
    message.includes('does not exist') ||
    message.includes('schema cache')
  );
}

async function archiveRow(supabase, table, id) {
  let payload = {
    status: 'archived',
    updated_at: new Date().toISOString(),
  };

  let { error } = await supabase
    .from(table)
    .update(payload)
    .eq('id', id);

  if (error && isMissingUpdatedAtColumn(error)) {
    const fallbackPayload = {
      status: 'archived',
    };

    const retry = await supabase
      .from(table)
      .update(fallbackPayload)
      .eq('id', id);

    error = retry.error || null;
  }

  if (error) {
    throw new Error(`[${table}] ${error.message}`);
  }
}

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

    await archiveRow(supabase, 'precontracts', precontractId);

    if (contractId) {
      await archiveRow(supabase, 'contracts', contractId);
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
