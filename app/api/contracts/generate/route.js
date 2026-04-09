import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildContractTemplateData } from '../../../../lib/contracts/buildContractTemplateData';

export const dynamic = 'force-dynamic';

function validateEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const templateId = process.env.CONTRACT_TEMPLATE_DOC_ID;
  const rootFolderId = process.env.CONTRACTS_DRIVE_FOLDER_ID;
  const contractServiceUrl = process.env.CONTRACT_SERVICE_URL;
  const contractServiceApiKey = process.env.CONTRACT_SERVICE_API_KEY || '';

  const missing = [];
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!templateId) missing.push('CONTRACT_TEMPLATE_DOC_ID');
  if (!rootFolderId) missing.push('CONTRACTS_DRIVE_FOLDER_ID');
  if (!contractServiceUrl) missing.push('CONTRACT_SERVICE_URL');

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Variáveis de ambiente faltando: ${missing.join(', ')}`,
    };
  }

  return {
    valid: true,
    supabaseUrl,
    supabaseServiceRoleKey,
    templateId,
    rootFolderId,
    contractServiceUrl,
    contractServiceApiKey,
  };
}

function getReadableErrorMessage(error) {
  if (!error) return 'Erro interno ao gerar contrato.';

  if (typeof error === 'string') return error;

  if (error instanceof Error) {
    return error.message || 'Erro interno ao gerar contrato.';
  }

  if (typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      return 'Erro interno ao gerar contrato.';
    }
  }

  return String(error);
}

async function getContractContext({ contractId, precontractId, supabase }) {
  let contract = null;

  if (contractId) {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (error) {
      throw new Error(`Erro ao buscar contract: ${error.message}`);
    }

    contract = data;
  } else if (precontractId) {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('precontract_id', precontractId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar contract por precontract: ${error.message}`);
    }

    contract = data || null;
  }

  if (!contract && !precontractId) {
    throw new Error('Informe contractId ou precontractId.');
  }

  const targetPrecontractId = contract?.precontract_id || precontractId || null;

  if (!targetPrecontractId) {
    throw new Error('PrecontractId não encontrado.');
  }

  const { data: precontract, error: preError } = await supabase
    .from('precontracts')
    .select('*')
    .eq('id', targetPrecontractId)
    .single();

  if (preError) {
    throw new Error(`Erro ao buscar precontract: ${preError.message}`);
  }

  let contact = null;
  const targetContactId = contract?.contact_id || precontract?.contact_id || null;

  if (targetContactId) {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', targetContactId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar contact: ${error.message}`);
    }

    contact = data || null;
  }

  let event = null;
  const targetEventId = contract?.event_id || precontract?.event_id || null;

  if (targetEventId) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', targetEventId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar event: ${error.message}`);
    }

    event = data || null;
  }

  return {
    contract,
    precontract,
    contact,
    event,
  };
}

function getContractName(context) {
  const clientName =
    context.contact?.name ||
    context.precontract?.client_name ||
    context.event?.client_name ||
    'Cliente';

  const eventDate =
    context.event?.event_date ||
    context.precontract?.event_date ||
    new Date().toISOString().slice(0, 10);

  return `Contrato - ${clientName} - ${eventDate}`;
}

async function callContractService({
  contractServiceUrl,
  contractServiceApiKey,
  payload,
}) {
  const baseUrl = String(contractServiceUrl || '').trim().replace(/\/+$/, '');
  const endpoint = `${baseUrl}/api/contracts/generate`;

  console.log('[/api/contracts/generate] chamando contract service:', {
    endpoint,
    hasApiKey: Boolean(contractServiceApiKey),
  });

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(contractServiceApiKey
          ? { 'x-api-key': contractServiceApiKey }
          : {}),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
  } catch (error) {
    throw new Error(
      `Falha ao conectar ao contract service: ${error?.message || 'erro desconhecido'}`
    );
  }

  let serviceJson = null;
  try {
    serviceJson = await response.json();
  } catch (_error) {
    throw new Error(
      `Contract service respondeu com payload inválido (status ${response.status}).`
    );
  }

  if (!response.ok || !serviceJson?.ok) {
    throw new Error(
      serviceJson?.message ||
        `Contract service falhou com status ${response.status}.`
    );
  }

  return serviceJson;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Use POST para gerar preview ou contrato final.',
  });
}

export async function POST(request) {
  try {
    const envCheck = validateEnv();

    if (!envCheck.valid) {
      return NextResponse.json(
        {
          ok: false,
          message: envCheck.error,
        },
        { status: 500 }
      );
    }

    const {
      supabaseUrl,
      supabaseServiceRoleKey,
      templateId,
      rootFolderId,
      contractServiceUrl,
      contractServiceApiKey,
    } = envCheck;

    console.log('templateId:', templateId);
    console.log('rootFolderId:', rootFolderId);
    console.log('contractServiceUrl:', contractServiceUrl);

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const body = await request.json();

    const contractId = body?.contractId || null;
    const precontractId = body?.precontractId || null;
    const previewOnly = !!body?.previewOnly;

    const context = await getContractContext({
      contractId,
      precontractId,
      supabase,
    });

    const templateData = buildContractTemplateData(context);

    if (previewOnly) {
      return NextResponse.json({
        ok: true,
        mode: 'preview',
        message: 'Template data gerado com sucesso.',
        ids: {
          contractId: context.contract?.id || null,
          precontractId: context.precontract?.id || null,
          contactId: context.contact?.id || null,
          eventId: context.event?.id || null,
        },
        templateData,
      });
    }

    if (!context.contract?.id && !context.precontract?.id) {
      throw new Error('Nenhum contexto válido encontrado para gerar o contrato.');
    }

    const contractName = getContractName(context);
    const eventDate =
      context.event?.event_date ||
      context.precontract?.event_date ||
      new Date().toISOString().slice(0, 10);

    console.log('[/api/contracts/generate] enviando para Render', {
      contractId: context.contract?.id || null,
      precontractId: context.precontract?.id || null,
      templateId,
      rootFolderId,
      contractName,
      eventDate,
    });

    let generated;

    try {
      generated = await callContractService({
        contractServiceUrl,
        contractServiceApiKey,
        payload: {
          templateId,
          rootFolderId,
          templateData,
          contractName,
          eventDate,
          placeholderStyle: 'double_curly',
        },
      });
    } catch (error) {
      console.error('Erro ao chamar contract service:', error);

      return NextResponse.json(
        {
          ok: false,
          message: getReadableErrorMessage(error),
          errorType: error?.name || 'ContractServiceError',
        },
        { status: 500 }
      );
    }

    if (context.contract?.id) {
      const { error: updateError } = await supabase
        .from('contracts')
        .update({
          doc_template_id: templateId,
          doc_url: generated.docUrl,
          pdf_url: generated.pdfUrl,
        })
        .eq('id', context.contract.id);

      if (updateError) {
        throw new Error(`Erro ao salvar links do contrato: ${updateError.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      mode: 'generated',
      message: 'Contrato gerado com sucesso.',
      ids: {
        contractId: context.contract?.id || null,
        precontractId: context.precontract?.id || null,
        contactId: context.contact?.id || null,
        eventId: context.event?.id || null,
      },
      docUrl: generated.docUrl,
      pdfUrl: generated.pdfUrl,
      folderYear: generated.folderYear,
      folderMonth: generated.folderMonth,
      templateData,
    });
  } catch (error) {
    console.error('Erro em /api/contracts/generate:', error);

    return NextResponse.json(
      {
        ok: false,
        message: error.message,
        errorType: error?.name || 'UnknownError',
      },
      { status: 500 }
    );
  }
}
