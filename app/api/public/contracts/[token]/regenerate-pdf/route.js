import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateAndSaveInternalContractPdf } from '@/lib/contracts/internalPdfFlow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function asString(value) {
  return String(value || '').trim();
}

function extractToken(params) {
  if (Array.isArray(params?.token)) return asString(params.token[0]);
  return asString(params?.token);
}

function pickSignedHtml(contract, precontract) {
  const raw = contract?.raw_payload || {};
  const candidates = [
    raw.signed_contract_html,
    raw.contract_html_snapshot,
    raw.contract_html,
    raw.generated_contract?.html,
    precontract?.custom_contract_rich_html,
    precontract?.custom_contract_content,
    precontract?.contract_template_text,
  ];

  return asString(candidates.find((value) => asString(value).length > 0));
}

async function updatePrecontractSignedIfNeeded({ supabase, precontractId }) {
  if (!precontractId) return;
  await supabase
    .from('precontracts')
    .update({ status: 'signed', updated_at: new Date().toISOString() })
    .eq('id', precontractId)
    .neq('status', 'signed');
}

export async function POST(_request, context) {
  const params = await context?.params;
  const token = extractToken(params);

  if (!token) {
    return NextResponse.json({ ok: false, message: 'Token inválido.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: precontract, error: preError } = await supabase
      .from('precontracts')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();

    if (preError) throw preError;
    if (!precontract?.id) {
      return NextResponse.json({ ok: false, message: 'Pré-contrato não encontrado.' }, { status: 404 });
    }

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('precontract_id', precontract.id)
      .maybeSingle();

    if (contractError) throw contractError;
    if (!contract?.id) {
      return NextResponse.json({ ok: false, message: 'Contrato vinculado não encontrado.' }, { status: 404 });
    }

    const isSigned =
      asString(contract.status).toLowerCase() === 'signed' ||
      asString(precontract.status).toLowerCase() === 'signed' ||
      Boolean(contract.signed_at);

    if (!isSigned) {
      return NextResponse.json(
        { ok: false, message: 'Contrato ainda não está assinado. Assine antes de regenerar o PDF.' },
        { status: 409 }
      );
    }

    const existingPdfUrl = asString(contract.pdf_url);
    if (existingPdfUrl) {
      await updatePrecontractSignedIfNeeded({ supabase, precontractId: precontract.id });
      return NextResponse.json({
        ok: true,
        repaired: false,
        message: 'PDF já estava disponível.',
        pdfUrl: existingPdfUrl,
        contractId: contract.id,
        precontractId: precontract.id,
      });
    }

    const html = pickSignedHtml(contract, precontract);
    if (!html) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Contrato assinado sem HTML salvo para regenerar PDF.',
          code: 'MISSING_SIGNED_HTML',
          contractId: contract.id,
          precontractId: precontract.id,
        },
        { status: 422 }
      );
    }

    const workspaceId = asString(contract.workspace_id || precontract.workspace_id);
    if (!workspaceId) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Contrato sem workspace_id para regenerar PDF.',
          code: 'MISSING_WORKSPACE',
          contractId: contract.id,
          precontractId: precontract.id,
        },
        { status: 422 }
      );
    }

    const result = await generateAndSaveInternalContractPdf({
      supabase,
      contractId: contract.id,
      precontractId: precontract.id,
      workspaceId,
      html,
    });

    const pdfUrl = asString(result?.pdfUrl);
    if (!pdfUrl) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Regeneração terminou sem pdfUrl.',
          code: 'MISSING_PDF_URL',
          result,
        },
        { status: 502 }
      );
    }

    await updatePrecontractSignedIfNeeded({ supabase, precontractId: precontract.id });

    return NextResponse.json({
      ok: true,
      repaired: true,
      pdfUrl,
      contractId: contract.id,
      precontractId: precontract.id,
      missingColumns: result?.missingColumns || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'Erro ao regenerar PDF do contrato.',
        code: error?.code || null,
        stage: error?.stage || error?.code || null,
      },
      { status: error?.status || 500 }
    );
  }
}
