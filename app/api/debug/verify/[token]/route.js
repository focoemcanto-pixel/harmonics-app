export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getSupabaseAdmin } from '@/lib/supabase-admin';

function asString(value) {
  return String(value || '').trim();
}

function resolveContractToken(contract) {
  const validationToken =
    contract?.signature_metadata?.validation_token ||
    contract?.signature_metadata?.verification_token ||
    contract?.raw_payload?.signature_metadata?.validation_token ||
    contract?.raw_payload?.signature_metadata?.verification_token ||
    null;

  return validationToken;
}

export async function GET(request, context) {
  const resolvedParams = await context?.params;
  const token = asString(Array.isArray(resolvedParams?.token) ? resolvedParams.token[0] : resolvedParams?.token);

  if (!token) {
    return Response.json({
      ok: false,
      token,
      error: 'TOKEN_EMPTY',
    });
  }

  const supabase = getSupabaseAdmin();

  const contractFields = `
    id,
    public_token,
    precontract_id,
    document_hash,
    pdf_url,
    status,
    signed_at,
    signature_metadata,
    raw_payload,
    created_at
  `;

  const { data: precontract } = await supabase
    .from('precontracts')
    .select('id, public_token, client_name, event_date, event_time, location_name, location_address')
    .eq('public_token', token)
    .maybeSingle();

  const { data: contractByPublicToken } = await supabase
    .from('contracts')
    .select(contractFields)
    .eq('public_token', token)
    .maybeSingle();

  const { data: contractByValidationOrVerificationOrHash } = await supabase
    .from('contracts')
    .select(contractFields)
    .eq('document_hash', token)
    .maybeSingle();

  const contractCandidates = [contractByPublicToken, contractByValidationOrVerificationOrHash].filter(Boolean);

  const contractByValidationToken =
    contractCandidates.find((contract) => asString(resolveContractToken(contract)) === token) || null;
  const contractByVerificationToken =
    contractCandidates.find((contract) => asString(resolveContractToken(contract)) === token) || null;
  const contractByDocumentHash =
    asString(contractByValidationOrVerificationOrHash?.document_hash) === token
      ? contractByValidationOrVerificationOrHash
      : null;

  let contractByPrecontract = null;
  let contractByPrecontractError = null;

  if (precontract?.id) {
    const { data, error } = await supabase
      .from('contracts')
      .select(contractFields)
      .eq('precontract_id', precontract.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    contractByPrecontract = data;
    contractByPrecontractError = error;
  }

  const finalContract =
    contractByPublicToken ||
    contractByValidationToken ||
    contractByVerificationToken ||
    contractByDocumentHash ||
    contractByPrecontract ||
    null;

  return Response.json({
    ok: true,
    token,
    precontractId: precontract?.id || null,
    contractByPrecontractError: contractByPrecontractError?.message || null,
    contractByPrecontractId: contractByPrecontract?.id || null,
    byPrecontractPublicToken: Boolean(precontract?.id && contractByPrecontract?.id),
    byPublicToken: Boolean(contractByPublicToken?.id),
    byValidationToken: Boolean(contractByValidationToken?.id),
    byVerificationToken: Boolean(contractByVerificationToken?.id),
    byDocumentHash: Boolean(contractByDocumentHash?.id),
    contractId: finalContract?.id || null,
    publicToken: finalContract?.public_token || null,
    validationToken: resolveContractToken(finalContract),
    verificationToken: resolveContractToken(finalContract),
    documentHash: finalContract?.document_hash || null,
    pdfUrl: finalContract?.pdf_url || null,
  });
}
