import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateAndSaveInternalContractPdf } from '@/lib/contracts/internalPdfFlow';
import { buildContractTemplateData } from '@/lib/contracts/buildContractTemplateData';
import { renderContractHtmlWithTemplateData, resolveContractHtmlSource } from '@/lib/contracts/resolveContractHtmlSource';
import { resolveEventTypeDefaultTemplateId } from '@/lib/contracts/precontract-template';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function asString(value) {
  return String(value || '').trim();
}

function extractToken(params) {
  if (Array.isArray(params?.token)) return asString(params.token[0]);
  return asString(params?.token);
}

function isGenericInternalFallbackHtml(html) {
  const value = asString(html).toLowerCase();
  return (
    value.includes('data-contract-source="internal-fallback"') ||
    (value.includes('<h1>contrato interno</h1>') &&
      value.includes('<strong>cliente:</strong>') &&
      value.includes('<strong>data do evento:</strong>') &&
      value.includes('<strong>valor:</strong>'))
  );
}

async function loadLinkedTemplate({ supabase, precontract }) {
  let templateId = asString(precontract?.contract_template_id);
  if (!templateId && precontract?.event_type_id) {
    templateId = await resolveEventTypeDefaultTemplateId({
      supabase,
      workspaceId: precontract?.workspace_id,
      eventTypeId: precontract?.event_type_id,
    });

    if (templateId && precontract?.id) {
      await supabase
        .from('precontracts')
        .update({
          contract_template_id: templateId,
          contract_mode: 'internal',
          custom_contract_enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', precontract.id);
      precontract.contract_template_id = templateId;
    }
  }

  if (!templateId) return null;

  const { data, error } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('id', templateId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

function resolveHtmlFromTemplate({ template, context }) {
  if (!template) return '';
  const source = resolveContractHtmlSource(template);
  const templateData = buildContractTemplateData(context);
  return renderContractHtmlWithTemplateData(source.html, templateData);
}

function pickExistingSignedHtml(contract) {
  const raw = contract?.raw_payload || {};
  const candidates = [
    raw.signed_contract_html,
    raw.contract_html_snapshot,
    raw.contract_html,
    raw.generated_contract?.html,
  ];

  return asString(candidates.find((value) => asString(value).length > 0));
}

function pickPrecontractEmbeddedHtml(precontract, context) {
  const source = resolveContractHtmlSource(precontract || {});
  const templateData = buildContractTemplateData(context);
  return renderContractHtmlWithTemplateData(source.html, templateData);
}

async function resolveRealContractHtml({ supabase, contract, precontract }) {
  const context = {
    contract,
    precontract,
    contact: null,
    event: null,
  };

  if (precontract?.contact_id || contract?.contact_id) {
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contract?.contact_id || precontract?.contact_id)
      .maybeSingle();
    context.contact = data || null;
  }

  if (precontract?.event_id || contract?.event_id) {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('id', contract?.event_id || precontract?.event_id)
      .maybeSingle();
    context.event = data || null;
  }

  const template = await loadLinkedTemplate({ supabase, precontract });
  const templateHtml = resolveHtmlFromTemplate({ template, context });
  if (templateHtml && !isGenericInternalFallbackHtml(templateHtml)) {
    return { html: templateHtml, source: 'contract_templates.contract_template_id', templateId: template?.id || null };
  }

  const existingSignedHtml = pickExistingSignedHtml(contract);
  if (existingSignedHtml && !isGenericInternalFallbackHtml(existingSignedHtml)) {
    return { html: existingSignedHtml, source: 'contract.raw_payload', templateId: null };
  }

  const embeddedHtml = pickPrecontractEmbeddedHtml(precontract, context);
  if (embeddedHtml && !isGenericInternalFallbackHtml(embeddedHtml)) {
    return { html: embeddedHtml, source: 'precontracts.embedded_contract', templateId: null };
  }

  return {
    html: '',
    source: 'missing',
    templateId: template?.id || null,
  };
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

    const resolved = await resolveRealContractHtml({ supabase, contract, precontract });
    if (!resolved.html) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Não foi encontrado HTML real do contrato/template para regenerar PDF. A geração foi bloqueada para evitar PDF genérico inválido.',
          code: 'MISSING_REAL_CONTRACT_HTML',
          source: resolved.source,
          templateId: resolved.templateId,
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
      html: resolved.html,
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
      source: resolved.source,
      templateId: resolved.templateId,
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
