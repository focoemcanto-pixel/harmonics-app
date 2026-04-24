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

  // 1) Buscar pré-contrato (opcional para fallback de busca do contrato).
  const { data: precontract, error: precontractError } = await supabase
    .from('precontracts')
    .select('*')
    .eq('public_token', token)
    .maybeSingle();

  // 2) Buscar contrato por token público primeiro.
  const { data: contractByToken } = await supabase
    .from('contracts')
    .select('*')
    .eq('public_token', token)
    .maybeSingle();

  // 3) Se não encontrou, buscar por precontract_id (quando houver pré-contrato).
  let contractByPrecontract = null;
  if (!contractByToken && precontract?.id) {
    const { data } = await supabase
      .from('contracts')
      .select('*')
      .eq('precontract_id', precontract.id)
      .maybeSingle();

    contractByPrecontract = data;
  }

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
    precontractId: precontract?.id || null,
    precontractLookupError: precontractError || null,
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

export async function POST(request, context) {
  const resolvedParams = await context?.params;
  const token = String(resolvedParams?.token || '').trim();

  const { searchParams } = new URL(request.url);
  const debugKey = searchParams.get('debugKey');

  if (debugKey !== process.env.DEBUG_INTERNAL_KEY) {
    return Response.json({ ok: false, code: 'UNAUTHORIZED_DEBUG' }, { status: 401 });
  }

  try {
    const res = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts/html-to-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CONTRACT_SERVICE_API_KEY,
      },
      body: JSON.stringify({
        html: '<h1>TESTE PDF</h1>',
      }),
    });

    const text = await res.text();

    return Response.json({
      ok: true,
      step: 'render_call',
      status: res.status,
      response: text,
    });
  } catch (err) {
    return Response.json({
      ok: false,
      step: 'render_call_error',
      error: String(err),
    });
  }
}
