export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateAndSaveInternalContractPdf } from '@/lib/contracts/internalPdfFlow';

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
    const supabase = getSupabaseAdmin();

    const { data: precontract, error: precontractError } = await supabase
      .from('precontracts')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();

    if (precontractError) {
      return Response.json(
        {
          ok: false,
          step: 'precontract_lookup_error',
          error: precontractError,
        },
        { status: 500 }
      );
    }

    const { data: contractByToken, error: contractByTokenError } = await supabase
      .from('contracts')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();

    if (contractByTokenError) {
      return Response.json(
        {
          ok: false,
          step: 'contract_lookup_by_token_error',
          error: contractByTokenError,
        },
        { status: 500 }
      );
    }

    let contractByPrecontract = null;
    if (!contractByToken && precontract?.id) {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('precontract_id', precontract.id)
        .maybeSingle();

      if (error) {
        return Response.json(
          {
            ok: false,
            step: 'contract_lookup_by_precontract_error',
            error,
          },
          { status: 500 }
        );
      }

      contractByPrecontract = data;
    }

    const contract = contractByToken || contractByPrecontract;
    const signedHtml =
      contract?.signed_html ||
      contract?.raw_payload?.signed_contract_html ||
      contract?.raw_payload?.contract_html_snapshot ||
      '';

    if (!precontract?.id) {
      return Response.json(
        {
          ok: false,
          step: 'missing_precontract',
          token,
        },
        { status: 404 }
      );
    }

    if (!contract?.id) {
      return Response.json(
        {
          ok: false,
          step: 'missing_contract',
          token,
          precontractId: precontract.id,
        },
        { status: 404 }
      );
    }

    if (!signedHtml) {
      return Response.json(
        {
          ok: false,
          step: 'missing_signed_html',
          token,
          precontractId: precontract.id,
          contractId: contract.id,
        },
        { status: 400 }
      );
    }

    const internalPdf = await generateAndSaveInternalContractPdf({
      supabase,
      contractId: contract.id,
      precontractId: precontract.id,
      html: signedHtml,
    });

    return Response.json({
      ok: true,
      step: 'internal_pdf_flow',
      pdfUrl: internalPdf?.pdfUrl || null,
    });
  } catch (err) {
    return Response.json({
      ok: false,
      step: 'internal_pdf_flow_error',
      error: String(err),
    });
  }
}
