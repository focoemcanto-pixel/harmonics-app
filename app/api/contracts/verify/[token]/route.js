import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function asString(value) {
  return String(value || '').trim();
}

function extractToken(params) {
  if (Array.isArray(params?.token)) return asString(params.token[0]);
  return asString(params?.token);
}

function normalizeStatus(value) {
  const status = asString(value).toLowerCase();
  if (!status) return 'desconhecido';
  return status;
}

export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  const params = await context?.params;
  const token = extractToken(params);

  if (!token) {
    return NextResponse.json({ ok: false, error: 'Token inválido.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    let contract = null;
    const byValidation = await supabase
      .from('contracts')
      .select('id, precontract_id, status, signed_at, document_hash, validation_token, verification_token, signature_metadata')
      .eq('validation_token', token)
      .maybeSingle();

    contract = byValidation.data || null;

    if (!contract?.id) {
      const byVerification = await supabase
        .from('contracts')
        .select('id, precontract_id, status, signed_at, document_hash, validation_token, verification_token, signature_metadata')
        .eq('verification_token', token)
        .maybeSingle();
      contract = byVerification.data || null;
    }

    if (!contract?.id) {
      const byMetadata = await supabase
        .from('contracts')
        .select('id, precontract_id, status, signed_at, document_hash, validation_token, verification_token, signature_metadata')
        .or(`signature_metadata->>validation_token.eq.${token},signature_metadata->>verification_token.eq.${token}`)
        .maybeSingle();
      contract = byMetadata.data || null;
    }

    if (!contract?.id) {
      return NextResponse.json({ ok: true, valid: false, status: 'invalid', token });
    }

    let precontract = null;
    if (contract.precontract_id) {
      const preResult = await supabase
        .from('precontracts')
        .select('client_name, event_date')
        .eq('id', contract.precontract_id)
        .maybeSingle();
      precontract = preResult.data || null;
    }

    const status = normalizeStatus(contract.status);
    const valid = status === 'signed' && !!contract.signed_at;

    return NextResponse.json({
      ok: true,
      valid,
      status,
      token,
      contract: {
        id: contract.id,
        hash: asString(contract.document_hash || contract?.signature_metadata?.document_hash),
        client_name: asString(precontract?.client_name),
        event_date: precontract?.event_date || null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Erro ao validar contrato.',
      },
      { status: 500 },
    );
  }
}
