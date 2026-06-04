import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateContractDocument } from '@/lib/contracts/generate-contract-document';
import { generatePdfBufferFromHtml } from '@/lib/contracts/htmlToPdfService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Variáveis do Supabase não configuradas para prévia do contrato.');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function fetchLegacyGasPreviewPdf({ token }) {
  const gasExec = process.env.HARMONICS_CONTRATO_GAS_EXEC_URL;
  const hk = process.env.HARMONICS_KEY_CONTRATO || '';

  if (!gasExec) return null;

  const previewResp = await fetch(gasExec, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fn: 'hcContratoGerarPreview',
      args: [token],
      __hk: hk,
      __origin: 'CONTRATO',
      __ip: '',
    }),
    redirect: 'follow',
    cache: 'no-store',
  });

  const previewJson = await previewResp.json().catch(() => null);

  if (!previewJson?.ok || !previewJson?.pdfUrl) {
    throw new Error(previewJson?.message || 'Não foi possível gerar a prévia do contrato.');
  }

  const pdfResp = await fetch(previewJson.pdfUrl, {
    method: 'GET',
    redirect: 'follow',
    cache: 'no-store',
  });

  if (!pdfResp.ok) {
    throw new Error('Não foi possível carregar o PDF.');
  }

  return Buffer.from(await pdfResp.arrayBuffer());
}

async function fetchInternalPreviewPdf({ token }) {
  const supabase = getSupabaseAdminClient();

  const { data: precontract, error: precontractError } = await supabase
    .from('precontracts')
    .select('id, public_token, client_name, event_date')
    .eq('public_token', token)
    .maybeSingle();

  if (precontractError) {
    throw new Error(`Erro ao buscar pré-contrato: ${precontractError.message}`);
  }

  if (!precontract?.id) {
    throw new Error('Pré-contrato não encontrado para este token.');
  }

  const result = await generateContractDocument({
    supabase,
    precontractId: precontract.id,
    previewOnly: true,
  });

  if (!result?.ok || !result?.html) {
    throw new Error(result?.message || result?.error || 'Não foi possível montar o HTML da prévia do contrato.');
  }

  return generatePdfBufferFromHtml({
    html: result.html,
    contractId: result?.ids?.contractId || null,
    precontractId: precontract.id,
    fileName: `contrato-preview-${token}.pdf`,
  });
}

export async function GET(_request, context) {
  try {
    const routeParams = await context?.params;
    const token = String(routeParams?.token || '').trim();

    if (!token) {
      return new NextResponse('Token inválido.', { status: 400 });
    }

    let pdfBuffer = null;

    try {
      pdfBuffer = await fetchLegacyGasPreviewPdf({ token });
    } catch (legacyError) {
      console.warn('[CONTRACT_PREVIEW][LEGACY_GAS_FAILED]', {
        token,
        message: legacyError?.message || String(legacyError),
      });
    }

    if (!pdfBuffer) {
      pdfBuffer = await fetchInternalPreviewPdf({ token });
    }

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="contrato-preview-${token}.pdf"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[CONTRACT_PREVIEW][ERROR]', {
      message: error?.message,
      stack: error?.stack,
    });

    return new NextResponse(
      error?.message || 'Erro ao gerar prévia do contrato.',
      { status: 500 }
    );
  }
}
