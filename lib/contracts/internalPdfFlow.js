import { logError, logInfo } from '@/lib/observability/server-log';
import { generatePdfBufferFromHtml } from '@/lib/contracts/htmlToPdfService';

const DEFAULT_BUCKET = 'contract-pdfs';

function asString(value) {
  return String(value ?? '').trim();
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
    throw buildStageError('STORAGE_ERROR', `Erro ao listar buckets: ${listError.message}`, {
      causeMessage: listError.message,
    });
  }

  const exists = (buckets || []).some((bucket) => bucket?.name === bucketName);
  if (exists) return;

  const { error: createError } = await supabase.storage.createBucket(bucketName, {
    public: true,
    fileSizeLimit: 20 * 1024 * 1024,
    allowedMimeTypes: ['application/pdf'],
  });

  if (createError) {
    throw buildStageError(
      'MISSING_BUCKET',
      `Bucket ${bucketName} não encontrado e não foi possível criá-lo: ${createError.message}`,
      { code: 'MISSING_BUCKET', causeMessage: createError.message }
    );
  }
}

function buildStageError(stage, message, extra = {}) {
  const error = new Error(message);
  error.code = extra.code || stage;
  error.status = extra.status;
  error.stage = stage;
  if (extra.causeMessage) error.causeMessage = extra.causeMessage;
  if (extra.serviceBody) error.serviceBody = extra.serviceBody;
  return error;
}

function getMissingColumnName(error) {
  const message = asString(error?.message);
  const match =
    message.match(/Could not find the '([^']+)' column/i) ||
    message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"?contracts"?\s+does\s+not\s+exist/i);
  return asString(match?.[1]);
}

async function updateContractWithSchemaFallback({ supabase, contractId, precontractId, payload }) {
  let currentPayload = { ...payload };
  const missingColumns = [];

  while (true) {
    let update = supabase.from('contracts').update(currentPayload);
    update = contractId ? update.eq('id', contractId) : update.eq('precontract_id', precontractId);
    const { error } = await update;

    if (!error) return { missingColumns };

    const missingColumn = getMissingColumnName(error);
    if (!missingColumn || !Object.prototype.hasOwnProperty.call(currentPayload, missingColumn)) {
      const wrapped = new Error(`Erro ao salvar PDF no contrato: ${error.message}`);
      wrapped.code = 'DB_UPDATE_ERROR';
      wrapped.stage = 'DB_UPDATE_ERROR';
      throw wrapped;
    }

    missingColumns.push(missingColumn);
    delete currentPayload[missingColumn];
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

  const workspaceId = contract?.workspace_id || null;
  return {
    contract,
    resolvedPrecontractId,
    workspaceId,
  };
}

async function persistContractFields({
  supabase,
  contractId,
  precontractId,
  workspaceId,
  pdfUrl,
  signedHtml,
}) {
  const generatedAt = new Date().toISOString();

  const rawPayload = {
    signed_contract_html: signedHtml,
    contract_html_snapshot: signedHtml,
    internal_pdf: {
      pdf_url: pdfUrl,
      generated_at: generatedAt,
    },
  };

  const patchPayload = {
    status: 'signed',
    workspace_id: workspaceId,
    pdf_url: pdfUrl,
    signed_snapshot_html: signedHtml,
    raw_payload: rawPayload,
  };

  return updateContractWithSchemaFallback({
    supabase,
    contractId,
    precontractId,
    payload: patchPayload,
  });
}

export async function generateAndSaveInternalContractPdf({
  supabase,
  contractId,
  precontractId,
  workspaceId,
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
      error.stage = 'MISSING_SUPABASE';
      throw error;
    }

    if (!signedHtml) {
      const error = new Error('HTML assinado é obrigatório para gerar o PDF interno.');
      error.code = 'MISSING_HTML';
      error.stage = 'MISSING_HTML';
      throw error;
    }

    const { contract, resolvedPrecontractId, workspaceId: contractWorkspaceId } = await loadContractContext(supabase, {
      contractId: normalizedContractId,
      precontractId: normalizedPrecontractId,
    });
    const effectiveWorkspaceId = asString(workspaceId || contractWorkspaceId) || null;

    logInfo('INTERNAL_PDF_FLOW', 'CONTEXT_RESOLVED', {
      contractId: contract?.id || normalizedContractId,
      precontractId: resolvedPrecontractId,
      workspaceId: effectiveWorkspaceId,
    });

    logInfo('INTERNAL_PDF_FLOW', 'SERVICE_CALL_START', {
      contractId: contract?.id || normalizedContractId,
      precontractId: resolvedPrecontractId,
      usingFlexibleHtmlToPdfHelper: true,
      hasServiceUrl: Boolean(process.env.CONTRACT_SERVICE_HTML_TO_PDF_URL || process.env.CONTRACT_SERVICE_URL || process.env.NEXT_PUBLIC_CONTRACT_SERVICE_URL),
      hasApiKey: Boolean(process.env.CONTRACT_SERVICE_API_KEY || process.env.NEXT_PUBLIC_CONTRACT_SERVICE_API_KEY),
    });

    let pdfBuffer;
    try {
      pdfBuffer = await generatePdfBufferFromHtml({
        html: signedHtml,
        contractId: contract?.id || normalizedContractId,
        precontractId: resolvedPrecontractId,
        fileName: `contrato-${contract?.id || normalizedContractId || resolvedPrecontractId}.pdf`,
        applyPremiumContractCss: true,
      });
    } catch (serviceError) {
      throw buildStageError(
        'SERVICE_ERROR',
        serviceError?.message || 'Não foi possível gerar o PDF do contrato neste momento.',
        {
          code: serviceError?.code || 'SERVICE_ERROR',
          status: serviceError?.status || 502,
          causeMessage: serviceError?.causeMessage || serviceError?.message || null,
          serviceBody: serviceError?.serviceBody || null,
        }
      );
    }

    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      throw buildStageError('SERVICE_ERROR', 'Serviço de PDF retornou arquivo vazio.', { status: 502 });
    }

    logInfo('INTERNAL_PDF_FLOW', 'SERVICE_CALL_OK', {
      hasPdfBuffer: true,
      pdfBytes: pdfBuffer.length,
      contractId: contract?.id || normalizedContractId,
      precontractId: resolvedPrecontractId,
    });

    const bucketName = DEFAULT_BUCKET;
    const path = `contracts/${resolvedPrecontractId || contract?.id || normalizedContractId}/contrato-assinado.pdf`;

    logInfo('INTERNAL_PDF_FLOW', 'UPLOAD_START', {
      contractId: contract?.id || normalizedContractId,
      precontractId: resolvedPrecontractId,
      bucketName,
      path,
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

    const persisted = await persistContractFields({
      supabase,
      contractId: contract?.id || normalizedContractId,
      precontractId: resolvedPrecontractId,
      workspaceId: effectiveWorkspaceId,
      pdfUrl,
      signedHtml,
    });

    logInfo('INTERNAL_PDF_FLOW', 'DB_UPDATE_OK', {
      contractId: contract?.id || normalizedContractId,
      precontractId: resolvedPrecontractId,
      hasPdfUrl: Boolean(pdfUrl),
      missingColumns: persisted?.missingColumns || [],
    });

    return {
      ok: true,
      pdfUrl,
      path,
      contractId: contract?.id || normalizedContractId,
      precontractId: resolvedPrecontractId,
      bucket: bucketName,
      missingColumns: persisted?.missingColumns || [],
    };
  } catch (error) {
    logError('INTERNAL_PDF_FLOW', 'ERROR', error, {
      stage: error?.stage || error?.code || 'UNKNOWN',
      code: error?.code || null,
      status: error?.status || null,
      message: error?.message || String(error),
      causeMessage: error?.causeMessage || null,
      serviceBody: error?.serviceBody || null,
    });
    throw error;
  }
}
