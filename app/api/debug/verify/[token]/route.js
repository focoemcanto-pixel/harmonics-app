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
    public_token,
    validation_token,
    verification_token,
    document_hash
  `;

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

  const contract = byPublicToken || byValidationOrVerificationOrHash || null;

  return Response.json({
    ok: true,
    token,
    byPublicToken: Boolean(byPublicToken?.id),
    byValidationToken: asString(contract?.validation_token) === token,
    byVerificationToken: asString(contract?.verification_token) === token,
    byDocumentHash: asString(contract?.document_hash) === token,
    contractId: contract?.id || null,
    publicToken: contract?.public_token || null,
    validationToken: contract?.validation_token || null,
    verificationToken: contract?.verification_token || null,
    documentHash: contract?.document_hash || null,
  });
}
