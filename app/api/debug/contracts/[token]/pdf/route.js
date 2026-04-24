export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request, context) {
  const resolvedParams = await context?.params;
  const token = String(resolvedParams?.token || '').trim();

  const { searchParams } = new URL(request.url);
  const debugKey = searchParams.get('debugKey');

  if (debugKey !== process.env.DEBUG_INTERNAL_KEY) {
    return Response.json({ ok: false, code: 'UNAUTHORIZED_DEBUG' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // 1. Buscar pré-contrato
  const { data: precontract, error } = await supabase
    .from('precontracts')
    .select('*')
    .eq('public_token', token)
    .single();

  if (error || !precontract) {
    return Response.json({
      ok: false,
      step: 'fetch_precontract',
      error,
      found: false,
    });
  }

  // 2. Verificar contrato e HTML assinado
  const { data: contractByToken } = await supabase
    .from('contracts')
    .select('*')
    .eq('public_token', token)
    .maybeSingle();

  const { data: contractByPrecontract } = await supabase
    .from('contracts')
    .select('*')
    .eq('precontract_id', precontract.id)
    .maybeSingle();

  const contract = contractByToken || contractByPrecontract;

  const signedHtml =
    contract?.signed_html ||
    contract?.raw_payload?.signed_contract_html ||
    contract?.raw_payload?.contract_html_snapshot ||
    '';

  return Response.json({
    ok: true,
    step: 'contract_debug',
    token,
    precontractId: precontract.id,
    foundContract: Boolean(contract?.id),
    contractId: contract?.id || null,
    contractStatus: contract?.status || null,
    hasSignedAt: Boolean(contract?.signed_at),
    hasDocumentHash: Boolean(contract?.document_hash),
    hasPdfUrl: Boolean(contract?.pdf_url),
    pdfUrl: contract?.pdf_url || null,
    hasSignedHtml: Boolean(signedHtml),
    signedHtmlLength: signedHtml.length,
    hasContractServiceUrl: Boolean(
      process.env.CONTRACT_SERVICE_URL || process.env.NEXT_PUBLIC_CONTRACT_SERVICE_URL
    ),
    hasContractServiceApiKey: Boolean(process.env.CONTRACT_SERVICE_API_KEY),
  });
}
