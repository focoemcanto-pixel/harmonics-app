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

  let byPrecontractPublicToken = null;
  if (precontract?.id) {
    const { data: contractByPrecontract } = await supabase
      .from('contracts')
      .select(contractFields)
      .eq('precontract_id', precontract.id)
      .maybeSingle();

    byPrecontractPublicToken = contractByPrecontract || null;
  }

  const { data: byPublicToken } = await supabase
    .from('contracts')
    .select(contractFields)
    .eq('public_token', token)
    .maybeSingle();

  const { data: byValidationOrVerificationOrHash } = await supabase
    .from('contracts')
    .select(contractFields)
    .or(`validation_token.eq.${token},verification_token.eq.${token},document_hash.eq.${token}`)
    .maybeSingle();

  const contract = byPrecontractPublicToken || byPublicToken || byValidationOrVerificationOrHash || null;

  return Response.json({
    ok: true,
    token,
    precontractId: precontract?.id || null,
    byPrecontractPublicToken: Boolean(precontract?.id && byPrecontractPublicToken?.id),
    byPublicToken: Boolean(byPublicToken?.id),
    byValidationToken: asString(contract?.validation_token) === token,
    byVerificationToken: asString(contract?.verification_token) === token,
    byDocumentHash: asString(contract?.document_hash) === token,
    contractId: contract?.id || null,
    publicToken: contract?.public_token || null,
    validationToken: contract?.validation_token || null,
    verificationToken: contract?.verification_token || null,
    documentHash: contract?.document_hash || null,
    pdfUrl: contract?.pdf_url || null,
  });
}
