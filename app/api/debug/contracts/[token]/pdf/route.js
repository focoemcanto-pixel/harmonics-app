export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateAndSaveInternalContractPdf } from '@/lib/contracts/internalPdfFlow';

function isAuthorizedDebugKey(request) {
  const { searchParams } = new URL(request.url);
  const debugKey = searchParams.get('debugKey');
  const expectedKey = process.env.DEBUG_INTERNAL_KEY;

  return Boolean(expectedKey) && debugKey === expectedKey;
}

function redactStorageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return {
      origin: parsed.origin,
      bucket: parts.includes('public') ? parts[parts.indexOf('public') + 1] || null : null,
      hasPath: parts.length > 0,
    };
  } catch {
    return {
      origin: null,
      bucket: null,
      hasPath: true,
    };
  }
}

async function resolveDebugContract({ supabase, token }) {
  const { data: precontract, error: precontractError } = await supabase
    .from('precontracts')
    .select('*')
    .eq('public_token', token)
    .maybeSingle();

  const { data: contractByToken, error: contractByTokenError } = await supabase
    .from('contracts')
    .select('*')
    .eq('public_token', token)
    .maybeSingle();

  let contractByPrecontract = null;
  let contractByPrecontractError = null;

  if (!contractByToken && precontract?.id) {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('precontract_id', precontract.id)
      .maybeSingle();

    contractByPrecontract = data;
    contractByPrecontractError = error;
  }

  return {
    precontract,
    precontractError,
    contract: contractByToken || contractByPrecontract,
    contractByTokenError,
    contractByPrecontractError,
  };
}

export async function GET(request, context) {
  const resolvedParams = await context?.params;
  const token = String(resolvedParams?.token || '').trim();

  if (!isAuthorizedDebugKey(request)) {
    return Response.json({ ok: false, code: 'UNAUTHORIZED_DEBUG' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const {
    precontract,
    precontractError,
    contract,
    contractByTokenError,
    contractByPrecontractError,
  } = await resolveDebugContract({ supabase, token });

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
    precontractLookupError: precontractError
      ? { message: precontractError.message, code: precontractError.code || null }
      : null,
    contractLookupByTokenError: contractByTokenError
      ? { message: contractByTokenError.message, code: contractByTokenError.code || null }
      : null,
    contractLookupByPrecontractError: contractByPrecontractError
      ? { message: contractByPrecontractError.message, code: contractByPrecontractError.code || null }
      : null,
    foundContract: Boolean(contract?.id),
    contractId: contract?.id || null,
    contractStatus: contract?.status || null,
    hasSignedAt: Boolean(contract?.signed_at),
    hasDocumentHash: Boolean(contract?.document_hash),
    hasPdfUrl: Boolean(contract?.pdf_url),
    pdfUrlRedacted: redactStorageUrl(contract?.pdf_url),
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

  if (!isAuthorizedDebugKey(request)) {
    return Response.json({ ok: false, code: 'UNAUTHORIZED_DEBUG' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const {
      precontract,
      precontractError,
      contract,
      contractByTokenError,
      contractByPrecontractError,
    } = await resolveDebugContract({ supabase, token });

    if (precontractError) {
      return Response.json(
        {
          ok: false,
          step: 'precontract_lookup_error',
          error: { message: precontractError.message, code: precontractError.code || null },
        },
        { status: 500 }
      );
    }

    if (contractByTokenError || contractByPrecontractError) {
      const error = contractByTokenError || contractByPrecontractError;
      return Response.json(
        {
          ok: false,
          step: 'contract_lookup_error',
          error: { message: error.message, code: error.code || null },
        },
        { status: 500 }
      );
    }

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
      hasPdfUrl: Boolean(internalPdf?.pdfUrl),
      pdfUrlRedacted: redactStorageUrl(internalPdf?.pdfUrl),
    });
  } catch (err) {
    return Response.json({
      ok: false,
      step: 'internal_pdf_flow_error',
      error: err?.message || String(err),
    });
  }
}
