import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildContractTemplateData } from '../../../../../lib/contracts/buildContractTemplateData';
import { renderContractHtmlWithData, resolveContractHtmlSource } from '../../../../../lib/contracts/resolveContractHtmlSource';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error('Supabase admin não configurado.');
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
}

function addPreviewSafetyCss(html) {
  return `
<style>
  html,
  body {
    min-height: 100% !important;
    height: auto !important;
    overflow-x: auto !important;
    overflow-y: visible !important;
    background: #ffffff !important;
    -webkit-overflow-scrolling: touch !important;
  }

  body {
    margin: 0 !important;
    padding: 18px !important;
    min-width: 720px !important;
    width: max-content !important;
  }

  .page,
  [data-contract-page],
  [data-document-page] {
    min-height: auto !important;
    height: auto !important;
    overflow: visible !important;
  }

  body,
  p,
  div,
  span,
  li,
  td,
  th {
    max-width: none !important;
    overflow-wrap: normal !important;
    word-break: normal !important;
  }

  p,
  li {
    white-space: normal !important;
  }

  table {
    max-width: none !important;
    table-layout: auto !important;
  }

  img,
  svg,
  canvas {
    max-width: 100% !important;
    height: auto !important;
  }

  h1,
  h2,
  h3 {
    max-width: 680px !important;
  }

  p,
  li,
  div {
    max-width: 680px;
  }

  @media (min-width: 768px) {
    body {
      min-width: 0 !important;
      width: auto !important;
      padding: 24px !important;
    }

    body,
    p,
    div,
    span,
    li,
    td,
    th {
      max-width: 100% !important;
      overflow-wrap: anywhere !important;
    }
  }
</style>
${html || ''}`;
}

export async function GET(_request, context) {
  try {
    const { token: rawToken } = await context.params;
    const token = String(rawToken || '').trim();

    if (!token) {
      return new NextResponse('Token inválido.', { status: 400 });
    }

    const supabase = getAdminSupabase();

    let precontract = null;
    let contract = null;

    const { data: preByToken, error: preError } = await supabase
      .from('precontracts')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();

    if (preError) throw preError;

    if (preByToken) {
      precontract = preByToken;
    } else {
      const { data: contractByToken, error: contractByTokenError } = await supabase
        .from('contracts')
        .select('*')
        .eq('public_token', token)
        .maybeSingle();

      if (contractByTokenError) throw contractByTokenError;

      if (contractByToken?.precontract_id) {
        const { data: preById, error: preByIdError } = await supabase
          .from('precontracts')
          .select('*')
          .eq('id', contractByToken.precontract_id)
          .maybeSingle();

        if (preByIdError) throw preByIdError;
        precontract = preById || null;
        contract = contractByToken || null;
      }
    }

    if (!precontract) {
      return new NextResponse('Pré-contrato não encontrado.', { status: 404 });
    }

    if (!contract) {
      const { data: contractByPre, error: contractError } = await supabase
        .from('contracts')
        .select('*')
        .eq('precontract_id', precontract.id)
        .maybeSingle();

      if (contractError) throw contractError;
      contract = contractByPre || null;
    }

    if (!precontract.public_token && token) {
      await supabase
        .from('precontracts')
        .update({ public_token: token })
        .eq('id', precontract.id);
    }

    let contact = null;
    let event = null;

    const contactId = contract?.contact_id || precontract?.contact_id || null;
    const eventId = contract?.event_id || precontract?.event_id || null;

    if (contactId) {
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .maybeSingle();
      contact = data || null;
    }

    if (eventId) {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();
      event = data || null;
    }

    const templateData = buildContractTemplateData({
      contract,
      precontract,
      contact,
      event,
    });

    let sourceHtml = resolveContractHtmlSource(precontract || {}).html;

    if (!String(sourceHtml || '').trim() && precontract?.contract_template_id) {
      const { data: templateDataRow } = await supabase
        .from('contract_templates')
        .select('content')
        .eq('id', precontract.contract_template_id)
        .maybeSingle();
      sourceHtml = resolveContractHtmlSource(templateDataRow || {}).html;
    }

    const html = renderContractHtmlWithData(sourceHtml, templateData).trim();

    if (!html) {
      return new NextResponse('Template de contrato não encontrado para este pré-contrato.', {
        status: 404,
      });
    }

    return new NextResponse(addPreviewSafetyCss(html), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return new NextResponse(
      error?.message || 'Erro ao gerar preview HTML.',
      { status: 500 }
    );
  }
}
