import { logError, logInfo } from '@/lib/observability/server-log';
const DEFAULT_BUCKET = 'contract-pdfs';

function asString(value) {
  return String(value ?? '').trim();
}

function resolveContractServiceEnv() {
  const contractServiceUrl = asString(
    process.env.CONTRACT_SERVICE_URL || process.env.NEXT_PUBLIC_CONTRACT_SERVICE_URL
  );
  const contractServiceApiKey = asString(process.env.CONTRACT_SERVICE_API_KEY);

  return { contractServiceUrl, contractServiceApiKey };
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
    const error = new Error('Bucket contract-pdfs não encontrado no Supabase Storage.');
    error.code = 'MISSING_BUCKET';
    error.stage = 'MISSING_BUCKET';
    throw error;
  }
}

function buildStageError(stage, message, extra = {}) {
  const error = new Error(message);
  error.code = extra.code || stage;
  error.status = extra.status;
  error.stage = stage;
  if (extra.causeMessage) error.causeMessage = extra.causeMessage;
  return error;
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

export async function generateAndSaveInternalContractPdf({
  supabase,
  contractId,
  precontractId,
  html,
}) {
  try {
    const normalizedContractId = asString(contractId) || null;
    const normalizedPrecontractId = asString(precontractId) || null;
    const signedHtml = stripHtmlWrapper(html);

    logInfo('INTERNAL_PDF_FLOW', 'START', {
      contractId: normalizedContractId,
      precontractId: normalizedPrecontractId,
      hasHtml: Boolean(signedHtml),
    });

    if (!supabase) {
      const error = new Error('Cliente Supabase é obrigatório para gerar PDF interno.');
      error.code = 'MISSING_SUPABASE';
      throw error;
    }

    if (!signedHtml) {
      const error = new Error('HTML assinado é obrigatório para gerar o PDF interno.');
      error.code = 'MISSING_HTML';
      throw error;
    }

    const { contract, resolvedPrecontractId } = await loadContractContext(supabase, {
      contractId: normalizedContractId,
      precontractId: normalizedPrecontractId,
    });
    logInfo('INTERNAL_PDF_FLOW', 'CONTEXT_RESOLVED', {
      contractId: contract?.id || normalizedContractId,
      precontractId: resolvedPrecontractId,
    });

    const { contractServiceUrl, contractServiceApiKey } = resolveContractServiceEnv();
    if (!contractServiceUrl) {
      throw buildStageError('MISSING_SERVICE_URL', 'CONTRACT_SERVICE_URL não configurado no ambiente do app.');
    }

    if (!contractServiceApiKey) {
      throw buildStageError(
        'SERVICE_UNAUTHORIZED',
        'CONTRACT_SERVICE_API_KEY não configurado no ambiente do app.'
      );
    }

    const htmlToPdfUrl = `${contractServiceUrl.replace(/\/+$/, '')}/api/contracts/html-to-pdf`;

    logInfo('INTERNAL_PDF_FLOW', 'SERVICE_CALL_START', {
      contractId: contract?.id || normalizedContractId,
      precontractId: resolvedPrecontractId,
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
        fileName: `contrato-${contract?.id || normalizedContractId || resolvedPrecontractId}.pdf`,
        responseFormat: 'base64',
      }),
    });

    const pdfPayload = await pdfResponse.json().catch(() => null);

    if (!pdfResponse.ok) {
      const error = new Error(
        pdfResponse.status === 401
          ? 'Serviço de PDF não autorizado. Verifique CONTRACT_SERVICE_API_KEY.'
          : 'Não foi possível gerar o PDF do contrato neste momento. Tente novamente em instantes.'
      );
      error.code = pdfResponse.status === 401 ? 'SERVICE_UNAUTHORIZED' : 'SERVICE_ERROR';
      error.status = pdfResponse.status;
      error.stage = pdfResponse.status === 401 ? 'SERVICE_UNAUTHORIZED' : 'SERVICE_ERROR';
      error.serviceBody = pdfPayload;
      throw error;
    }

    const pdfBase64 = asString(pdfPayload?.pdfBase64);
    if (!pdfBase64) {
      throw buildStageError(
        'SERVICE_ERROR',
        'Resposta inválida do serviço de geração de PDF (pdfBase64 ausente).',
        { status: 502 }
      );
    }

    logInfo('INTERNAL_PDF_FLOW', 'SERVICE_CALL_OK', {
      status: pdfResponse.status,
      hasPdfBase64: true,
      contractId: contract?.id || normalizedContractId,
      precontractId: resolvedPrecontractId,
    });

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const bucketName = DEFAULT_BUCKET;
    const path = `contracts/${resolvedPrecontractId || contract?.id || normalizedContractId}/contrato-assinado.pdf`;

    logInfo('INTERNAL_PDF_FLOW', 'UPLOAD_START', {
      contractId: contract?.id || normalizedContractId,
      precontractId: resolvedPrecontractId,
    });

    await ensureBucketExists(supabase, bucketName);

    const { error: uploadError } = await supabase.storage.from(bucketName).upload(path, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

    if (uploadError) {
      throw buildStageError('STORAGE_ERROR', `Erro ao salvar PDF no Storage: ${uploadError.message}`, {
        causeMessage: uploadError.message,
      });
    }

    logInfo('INTERNAL_PDF_FLOW', 'UPLOAD_OK', {
      contractId: contract?.id || normalizedContractId,
      precontractId: resolvedPrecontractId,
    });

    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(path);
    const pdfUrl = asString(publicData?.publicUrl);

    if (!pdfUrl) {
      throw buildStageError(
        'STORAGE_ERROR',
        'Não foi possível obter a URL pública do PDF gerado (URL pública ausente/inválida).'
      );
    }

    await persistContractFields({
      supabase,
      contractId: contract?.id || normalizedContractId,
      precontractId: resolvedPrecontractId,
      pdfUrl,
      signedHtml,
    });

    logInfo('INTERNAL_PDF_FLOW', 'DB_UPDATE_OK', {
      contractId: contract?.id || normalizedContractId,
      precontractId: resolvedPrecontractId,
      hasPdfUrl: Boolean(pdfUrl),
    });

    return {
      ok: true,
      pdfUrl,
      path,
      contractId: contract?.id || normalizedContractId,
      precontractId: resolvedPrecontractId,
      bucket: bucketName,
    };
  } catch (error) {
    logError('INTERNAL_PDF_FLOW', 'ERROR', error, {
      stage: error?.stage || error?.code || 'UNKNOWN',
      code: error?.code || null,
      status: error?.status || null,
      message: error?.message || String(error),
      causeMessage: error?.causeMessage || null,
    });
    throw error;
  }
}
