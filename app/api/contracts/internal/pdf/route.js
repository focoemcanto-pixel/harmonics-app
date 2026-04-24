import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_BUCKET = 'contract-pdfs';

function asString(value) {
  return String(value ?? '').trim();
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

  return { contractServiceUrl, contractServiceApiKey, contractServiceHost };
}

function stripHtmlWrapper(html) {
  const value = asString(html);
  if (!value) return '';

  if (/^<!doctype html/i.test(value) || /<html[\s>]/i.test(value)) {
    return value;
  }

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /></head><body>${value}</body></html>`;
}

async function ensureBucketExists(supabase, bucketName) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Erro ao listar buckets: ${listError.message}`);
  }

  const exists = (buckets || []).some((bucket) => bucket?.name === bucketName);
  if (!exists) {
    const error = new Error('Bucket contract-pdfs não encontrado.');
    error.code = 'MISSING_BUCKET';
    throw error;
  }
}

async function loadContractContext(supabase, { contractId, precontractId }) {
  if (!contractId && !precontractId) {
    const error = new Error('Informe contractId ou precontractId para gerar PDF interno.');
    error.code = 'MISSING_CONTRACT';
    throw error;
  }

  let contract = null;

  if (contractId) {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .maybeSingle();

    if (error) throw new Error(`Erro ao buscar contrato: ${error.message}`);
    contract = data || null;
  }

  if (!contract && precontractId) {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('precontract_id', precontractId)
      .maybeSingle();

    if (error) throw new Error(`Erro ao buscar contrato por precontract: ${error.message}`);
    contract = data || null;
  }

  if (!contract) {
    const error = new Error('Contrato não encontrado para os identificadores informados.');
    error.code = 'MISSING_CONTRACT';
    throw error;
  }

  const resolvedPrecontractId = contract?.precontract_id || precontractId || null;

  if (!resolvedPrecontractId) {
    const error = new Error('PrecontractId não encontrado para o contrato informado.');
    error.code = 'MISSING_CONTRACT';
    throw error;
  }

  return {
    contract,
    resolvedPrecontractId,
  };
}

async function persistContractFields({
  supabase,
  contractId,
  precontractId,
  pdfUrl,
  signedHtml,
}) {
  const generatedAt = new Date().toISOString();

  const patchPayload = {
    status: 'signed',
    pdf_url: pdfUrl,
    signed_snapshot_html: signedHtml,
    raw_payload: {
      signed_contract_html: signedHtml,
      contract_html_snapshot: signedHtml,
      internal_pdf: {
        pdf_url: pdfUrl,
        generated_at: generatedAt,
      },
    },
  };

  let update = supabase.from('contracts').update(patchPayload);
  update = contractId ? update.eq('id', contractId) : update.eq('precontract_id', precontractId);

  const { error: withSnapshotError } = await update;

  if (
    withSnapshotError &&
    asString(withSnapshotError.message).toLowerCase().includes('signed_snapshot_html')
  ) {
    const fallbackPayload = {
      ...patchPayload,
      raw_payload: {
        signed_contract_html: signedHtml,
        contract_html_snapshot: signedHtml,
        internal_pdf: {
          pdf_url: pdfUrl,
          generated_at: generatedAt,
        },
      },
    };
    delete fallbackPayload.signed_snapshot_html;

    let fallbackUpdate = supabase.from('contracts').update(fallbackPayload);
    fallbackUpdate = contractId
      ? fallbackUpdate.eq('id', contractId)
      : fallbackUpdate.eq('precontract_id', precontractId);

    const { error: fallbackError } = await fallbackUpdate;
    if (fallbackError) {
      const error = new Error(`Erro ao salvar PDF no contrato: ${fallbackError.message}`);
      error.code = 'DB_UPDATE_ERROR';
      throw error;
    }

    return;
  }

  if (withSnapshotError) {
    const error = new Error(`Erro ao salvar PDF no contrato: ${withSnapshotError.message}`);
    error.code = 'DB_UPDATE_ERROR';
    throw error;
  }
}

function errorResponse(code, message, status) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const contractId = asString(body?.contractId) || null;
    const precontractId = asString(body?.precontractId) || null;
    const signedHtml = stripHtmlWrapper(body?.html || body?.signedHtml || '');

    console.info('[CONTRACT_INTERNAL_PDF][START]', {
      contractId,
      precontractId,
      hasHtml: Boolean(signedHtml),
      htmlLength: signedHtml.length,
    });

    if (!signedHtml) {
      return errorResponse('MISSING_HTML', 'HTML assinado é obrigatório para gerar o PDF interno.', 400);
    }

    const supabase = getSupabaseAdmin();

    const { contract, resolvedPrecontractId } = await loadContractContext(supabase, {
      contractId,
      precontractId,
    });

    const { contractServiceUrl, contractServiceApiKey, contractServiceHost } = resolveContractServiceEnv();

    console.info('[CONTRACT_INTERNAL_PDF][SERVICE_CONFIG]', {
      hasContractServiceUrl: Boolean(contractServiceUrl),
      contractServiceHost,
      hasContractServiceApiKey: Boolean(contractServiceApiKey),
    });

    if (!contractServiceUrl) {
      return errorResponse('MISSING_SERVICE_URL', 'CONTRACT_SERVICE_URL não configurado no ambiente do app.', 500);
    }

    const htmlToPdfUrl = `${contractServiceUrl.replace(/\/+$/, '')}/api/contracts/html-to-pdf`;

    console.info('[CONTRACT_INTERNAL_PDF][CALLING_RENDER]', {
      htmlToPdfUrl,
      hasApiKey: Boolean(contractServiceApiKey),
    });

    const pdfResponse = await fetch(htmlToPdfUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': contractServiceApiKey,
      },
      body: JSON.stringify({
        html: signedHtml,
        fileName: `contrato-${contract?.id || contractId || resolvedPrecontractId}.pdf`,
        responseFormat: 'base64',
      }),
    });

    const pdfPayload = await pdfResponse.json().catch(() => null);

    console.info('[CONTRACT_INTERNAL_PDF][RENDER_RESPONSE]', {
      status: pdfResponse.status,
      ok: pdfResponse.ok,
      message: pdfPayload?.message || null,
      hasPdfBase64: Boolean(asString(pdfPayload?.pdfBase64)),
    });

    if (!pdfResponse.ok) {
      if (pdfResponse.status === 401) {
        return errorResponse(
          'SERVICE_UNAUTHORIZED',
          'Serviço de PDF não autorizado. Verifique CONTRACT_SERVICE_API_KEY.',
          401
        );
      }

      return errorResponse(
        'SERVICE_ERROR',
        'Não foi possível gerar o PDF do contrato neste momento. Tente novamente em instantes.',
        502
      );
    }

    const pdfBase64 = asString(pdfPayload?.pdfBase64);
    if (!pdfBase64) {
      return errorResponse(
        'SERVICE_ERROR',
        'Resposta inválida do serviço de geração de PDF (pdfBase64 ausente).',
        502
      );
    }

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    const bucketName = DEFAULT_BUCKET;
    const objectPath = `contracts/${resolvedPrecontractId || contract?.id || contractId}/contrato-assinado.pdf`;

    console.info('[CONTRACT_INTERNAL_PDF][STORAGE_UPLOAD_START]', {
      bucketName,
      objectPath,
      bytes: pdfBuffer.length,
    });

    await ensureBucketExists(supabase, bucketName);

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(objectPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      return errorResponse('STORAGE_ERROR', `Erro ao salvar PDF no Storage: ${uploadError.message}`, 500);
    }

    console.info('[CONTRACT_INTERNAL_PDF][STORAGE_UPLOAD_SUCCESS]', {
      bucketName,
      objectPath,
    });

    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(objectPath);
    const pdfUrl = asString(publicData?.publicUrl);

    if (!pdfUrl) {
      return errorResponse('STORAGE_ERROR', 'Não foi possível obter a URL pública do PDF gerado.', 500);
    }

    await persistContractFields({
      supabase,
      contractId: contract?.id || contractId,
      precontractId: resolvedPrecontractId,
      pdfUrl,
      signedHtml,
    });

    console.info('[CONTRACT_INTERNAL_PDF][DB_UPDATE_SUCCESS]', {
      contractId: contract?.id || contractId,
      precontractId: resolvedPrecontractId,
      pdfUrl,
    });

    return NextResponse.json({
      ok: true,
      mode: 'internal',
      contractId: contract?.id || contractId || null,
      precontractId: resolvedPrecontractId,
      pdfUrl,
      storage: {
        bucket: bucketName,
        path: objectPath,
      },
    });
  } catch (error) {
    console.error('[CONTRACT_INTERNAL_PDF][UNEXPECTED_ERROR]', error);

    if (error?.code === 'MISSING_BUCKET') {
      return errorResponse('MISSING_BUCKET', error.message, 500);
    }

    if (error?.code === 'MISSING_CONTRACT') {
      return errorResponse('MISSING_CONTRACT', error.message, 404);
    }

    if (error?.code === 'DB_UPDATE_ERROR') {
      return errorResponse('DB_UPDATE_ERROR', error.message, 500);
    }

    return errorResponse(
      'SERVICE_ERROR',
      'Não foi possível gerar o PDF do contrato neste momento. Tente novamente em instantes.',
      500
    );
  }
}
