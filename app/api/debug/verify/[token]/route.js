export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getSupabaseAdmin } from '@/lib/supabase-admin';

function asString(value) {
  return String(value || '').trim();
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
    precontract_id,
    public_token,
    validation_token,
    verification_token,
    document_hash,
    pdf_url
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
    .or(`validation_token.eq.${token},verification_token.eq.${token},document_hash.eq.${token}`)
    .maybeSingle();

  const contractByValidationToken =
    asString(contractByValidationOrVerificationOrHash?.validation_token) === token
      ? contractByValidationOrVerificationOrHash
      : null;
  const contractByVerificationToken =
    asString(contractByValidationOrVerificationOrHash?.verification_token) === token
      ? contractByValidationOrVerificationOrHash
      : null;
  const contractByDocumentHash =
    asString(contractByValidationOrVerificationOrHash?.document_hash) === token
      ? contractByValidationOrVerificationOrHash
      : null;

  const { data: contractByPrecontract, error: contractByPrecontractError } = await supabase
    .from('contracts')
    .select('id, public_token, precontract_id, validation_token, verification_token, document_hash, pdf_url, status, signed_at')
    .eq('precontract_id', precontract.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

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
    validationToken: finalContract?.validation_token || null,
    verificationToken: finalContract?.verification_token || null,
    documentHash: finalContract?.document_hash || null,
    pdfUrl: finalContract?.pdf_url || null,
  });
}
