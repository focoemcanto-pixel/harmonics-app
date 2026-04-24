import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_BUCKET = 'contract-pdfs';

function resolveContractServiceEnv() {
  const contractServiceUrl = String(
    process.env.CONTRACT_SERVICE_URL || process.env.NEXT_PUBLIC_CONTRACT_SERVICE_URL || ''
  ).trim();
  const contractServiceApiKey = String(process.env.CONTRACT_SERVICE_API_KEY || '').trim();

  return { contractServiceUrl, contractServiceApiKey };
}

function stripHtmlWrapper(html) {
  const value = String(html || '').trim();
  if (!value) return '';

  if (/^<!doctype html/i.test(value) || /<html[\s>]/i.test(value)) {
    return value;
  }

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /></head><body>${value}</body></html>`;
}

async function ensureBucketExists(supabase, bucketName) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  const exists = (buckets || []).some((bucket) => bucket?.name === bucketName);
  if (!exists) {
    throw new Error('Bucket contract-pdfs não encontrado.');
  }
}

async function loadContractContext(supabase, { contractId, precontractId }) {
  if (!contractId && !precontractId) {
    throw new Error('Informe contractId ou precontractId para gerar PDF interno.');
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

  const resolvedPrecontractId = contract?.precontract_id || precontractId || null;

  if (!resolvedPrecontractId) {
    throw new Error('PrecontractId não encontrado para o contrato informado.');
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
    String(withSnapshotError.message || '').toLowerCase().includes('signed_snapshot_html')
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
      throw new Error(`Erro ao salvar PDF no contrato: ${fallbackError.message}`);
    }

    return;
  }

  if (withSnapshotError) {
    throw new Error(`Erro ao salvar PDF no contrato: ${withSnapshotError.message}`);
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const contractId = String(body?.contractId || '').trim() || null;
    const precontractId = String(body?.precontractId || '').trim() || null;
    const signedHtml = stripHtmlWrapper(body?.html || body?.signedHtml || '');

    console.info('[CONTRACT_INTERNAL_PDF][REQUEST_CONTEXT]', {
      contractId,
      precontractId,
      hasHtml: !!signedHtml,
      htmlLength: signedHtml.length,
    });

    if (!signedHtml) {
      return NextResponse.json(
        { ok: false, message: 'HTML assinado é obrigatório para gerar o PDF interno.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { contract, resolvedPrecontractId } = await loadContractContext(supabase, {
      contractId,
      precontractId,
    });

    const { contractServiceUrl, contractServiceApiKey } = resolveContractServiceEnv();

    if (!contractServiceUrl) {
      return NextResponse.json({
        ok: false,
        pending: true,
        message: 'Serviço de PDF não configurado.',
      });
    }

    const htmlToPdfUrl = `${contractServiceUrl.replace(/\/+$/, '')}/api/contracts/html-to-pdf`;
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

    console.info('[CONTRACT_INTERNAL_PDF][SERVICE_RESPONSE]', {
      status: pdfResponse.status,
      ok: pdfResponse.ok,
      hasPdfBase64: !!String(pdfPayload?.pdfBase64 || '').trim(),
      message: pdfPayload?.message || null,
    });

    if (!pdfResponse.ok) {
      console.error('[CONTRACT_INTERNAL_PDF] erro no serviço de PDF:', {
        status: pdfResponse.status,
        statusText: pdfResponse.statusText,
        payload: pdfPayload,
      });
      return NextResponse.json(
        {
          ok: false,
          message: 'Não foi possível gerar o PDF do contrato neste momento. Tente novamente em instantes.',
        },
        { status: 502 }
      );
    }

    const pdfBase64 = String(pdfPayload?.pdfBase64 || '').trim();
    if (!pdfBase64) {
      console.error('[CONTRACT_INTERNAL_PDF] resposta inválida do serviço de PDF:', pdfPayload);
      return NextResponse.json(
        {
          ok: false,
          message: 'Não foi possível gerar o PDF do contrato neste momento. Tente novamente em instantes.',
        },
        { status: 502 }
      );
    }

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    const bucketName = DEFAULT_BUCKET;
    const objectPath = `contracts/${resolvedPrecontractId || contract?.id || contractId}/contrato-assinado.pdf`;

    await ensureBucketExists(supabase, bucketName);

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(objectPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Erro ao salvar PDF no Storage: ${uploadError.message}`);
    }

    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(objectPath);
    const pdfUrl = String(publicData?.publicUrl || '').trim();

    if (!pdfUrl) {
      throw new Error('Não foi possível obter a URL pública do PDF gerado.');
    }

    await persistContractFields({
      supabase,
      contractId: contract?.id || contractId,
      precontractId: resolvedPrecontractId,
      pdfUrl,
      signedHtml,
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
    console.error('[CONTRACT_INTERNAL_PDF] erro ao gerar PDF interno:', error);

    return NextResponse.json(
      {
        ok: false,
        message: 'Não foi possível gerar o PDF do contrato neste momento. Tente novamente em instantes.',
      },
      { status: 500 }
    );
  }
}
