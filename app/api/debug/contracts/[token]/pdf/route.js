import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function asString(value) {
  return String(value ?? '').trim();
}

function isDebugAuthorized(request) {
  const key = asString(process.env.DEBUG_INTERNAL_KEY);
  const debugKey = asString(new URL(request.url).searchParams.get('debugKey'));

  if (key) return debugKey === key;
  return process.env.NODE_ENV !== 'production';
}

function resolveContractServiceEnv() {
  const contractServiceUrl = asString(
    process.env.CONTRACT_SERVICE_URL || process.env.NEXT_PUBLIC_CONTRACT_SERVICE_URL
  );
  const contractServiceApiKey = asString(process.env.CONTRACT_SERVICE_API_KEY);

  let contractServiceHost = null;
  try {
    contractServiceHost = contractServiceUrl ? new URL(contractServiceUrl).host : null;
  } catch {
    contractServiceHost = null;
  }

  return {
    contractServiceUrl,
    contractServiceApiKey,
    contractServiceHost,
  };
}

async function resolveContextByToken(supabase, token) {
  const { data: precontract, error: precontractError } = await supabase
    .from('precontracts')
    .select('*')
    .eq('public_token', token)
    .maybeSingle();

  if (precontractError) {
    throw new Error(`Erro ao buscar precontract: ${precontractError.message}`);
  }

  let contract = null;

  const { data: contractByToken, error: contractByTokenError } = await supabase
    .from('contracts')
    .select('*')
    .eq('public_token', token)
    .maybeSingle();

  if (contractByTokenError) {
    throw new Error(`Erro ao buscar contract por token: ${contractByTokenError.message}`);
  }

  contract = contractByToken || null;

  if (!contract && precontract?.id) {
    const { data: contractByPrecontract, error: contractByPrecontractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('precontract_id', precontract.id)
      .maybeSingle();

    if (contractByPrecontractError) {
      throw new Error(`Erro ao buscar contract por precontract_id: ${contractByPrecontractError.message}`);
    }

    contract = contractByPrecontract || null;
  }

  return { precontract, contract };
}

function resolveSignedHtmlCandidates(contract) {
  const signedHtml = asString(contract?.signed_html);
  const rawSignedHtml = asString(contract?.raw_payload?.signed_contract_html);
  const rawSnapshotHtml = asString(contract?.raw_payload?.contract_html_snapshot);

  return {
    signedHtml,
    rawSignedHtml,
    rawSnapshotHtml,
    chosenHtml: signedHtml || rawSignedHtml || rawSnapshotHtml,
  };
}

async function checkContractBucket(supabase) {
  const bucketName = 'contract-pdfs';
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) return false;
  return (buckets || []).some((bucket) => bucket?.name === bucketName);
}

async function buildDebugResponse({ supabase, token, precontract, contract }) {
  const { contractServiceUrl, contractServiceApiKey, contractServiceHost } = resolveContractServiceEnv();
  const html = resolveSignedHtmlCandidates(contract);
  const hasBucketContractPdfs = await checkContractBucket(supabase);

  return {
    ok: true,
    token,
    foundPrecontract: Boolean(precontract),
    precontractId: precontract?.id || null,
    foundContract: Boolean(contract),
    contractId: contract?.id || null,
    contractPublicToken: contract?.public_token || null,
    contractStatus: contract?.status || null,
    hasSignedAt: Boolean(contract?.signed_at),
    hasDocumentHash: Boolean(contract?.document_hash),
    hasPdfUrl: Boolean(contract?.pdf_url),
    pdfUrl: contract?.pdf_url || null,
    hasSignedHtml: Boolean(html.signedHtml),
    signedHtmlLength: html.signedHtml.length,
    hasRawSignedHtml: Boolean(html.rawSignedHtml),
    rawSignedHtmlLength: html.rawSignedHtml.length,
    hasContractServiceUrl: Boolean(contractServiceUrl),
    contractServiceHost,
    hasContractServiceApiKey: Boolean(contractServiceApiKey),
    hasBucketContractPdfs,
  };
}

export async function GET(request, context) {
  if (!isDebugAuthorized(request)) {
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED_DEBUG' }, { status: 403 });
  }

  try {
    const token = asString(context?.params?.token);
    if (!token) {
      return NextResponse.json({ ok: false, code: 'MISSING_TOKEN' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { precontract, contract } = await resolveContextByToken(supabase, token);

    return NextResponse.json(await buildDebugResponse({ supabase, token, precontract, contract }));
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: 'DEBUG_FETCH_ERROR', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request, context) {
  if (!isDebugAuthorized(request)) {
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED_DEBUG' }, { status: 403 });
  }

  try {
    const token = asString(context?.params?.token);
    if (!token) {
      return NextResponse.json({ ok: false, step: 'resolve-token', code: 'MISSING_TOKEN' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { precontract, contract } = await resolveContextByToken(supabase, token);

    if (!contract) {
      return NextResponse.json(
        {
          ok: false,
          step: 'resolve-contract',
          internalPdfStatus: null,
          internalPdfResponse: { code: 'MISSING_CONTRACT' },
          pdfUrl: null,
        },
        { status: 404 }
      );
    }

    const { chosenHtml } = resolveSignedHtmlCandidates(contract);

    if (!chosenHtml) {
      return NextResponse.json(
        {
          ok: false,
          step: 'resolve-html',
          internalPdfStatus: null,
          internalPdfResponse: { code: 'MISSING_HTML' },
          pdfUrl: contract?.pdf_url || null,
        },
        { status: 400 }
      );
    }

    const payload = {
      contractId: contract.id,
      precontractId: contract.precontract_id || precontract?.id || null,
      html: chosenHtml,
    };

    const internalRes = await fetch(new URL('/api/contracts/internal/pdf', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const internalJson = await internalRes.json().catch(() => null);
    const resolvedPdfUrl = asString(internalJson?.pdfUrl || contract?.pdf_url) || null;

    return NextResponse.json(
      {
        ok: internalRes.ok,
        step: internalRes.ok ? 'done' : 'internal-pdf',
        internalPdfStatus: internalRes.status,
        internalPdfResponse: internalJson,
        pdfUrl: resolvedPdfUrl,
      },
      { status: internalRes.ok ? 200 : internalRes.status }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        step: 'unexpected',
        internalPdfStatus: null,
        internalPdfResponse: { code: 'DEBUG_POST_ERROR', message: error.message },
        pdfUrl: null,
      },
      { status: 500 }
    );
  }
}
