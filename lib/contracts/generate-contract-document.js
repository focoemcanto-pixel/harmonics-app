import { buildContractTemplateData } from './buildContractTemplateData';
import { generateInternalContract } from './internalContractGenerator';

const IS_DEV = process.env.NODE_ENV !== 'production';

function devLog(message, payload) {
  if (!IS_DEV) return;
  if (payload === undefined) {
    console.info(message);
    return;
  }
  console.info(message, payload);
}

function validateGoogleDocsEnv() {
  const templateId = process.env.CONTRACT_TEMPLATE_DOC_ID;
  const rootFolderId = process.env.CONTRACTS_DRIVE_FOLDER_ID;

  const contractServiceUrl =
    process.env.CONTRACT_SERVICE_URL ||
    process.env.NEXT_PUBLIC_CONTRACT_SERVICE_URL;

  const contractServiceApiKey =
    process.env.CONTRACT_SERVICE_API_KEY ||
    process.env.NEXT_PUBLIC_CONTRACT_SERVICE_API_KEY ||
    '';

  const missing = [];
  if (!templateId) missing.push('CONTRACT_TEMPLATE_DOC_ID');
  if (!rootFolderId) missing.push('CONTRACTS_DRIVE_FOLDER_ID');
  if (!contractServiceUrl) missing.push('CONTRACT_SERVICE_URL ou NEXT_PUBLIC_CONTRACT_SERVICE_URL');

  if (missing.length > 0) {
    return { valid: false, error: `Variáveis de ambiente faltando: ${missing.join(', ')}` };
  }

  return { valid: true, templateId, rootFolderId, contractServiceUrl, contractServiceApiKey };
}

async function getContractContext({ contractId, precontractId, supabase }) {
  let contract = null;

  if (contractId) {
    const { data, error } = await supabase.from('contracts').select('*').eq('id', contractId).single();
    if (error) throw new Error(`Erro ao buscar contract: ${error.message}`);
    contract = data;
  } else if (precontractId) {
    const { data, error } = await supabase.from('contracts').select('*').eq('precontract_id', precontractId).maybeSingle();
    if (error) throw new Error(`Erro ao buscar contract por precontract: ${error.message}`);
    contract = data || null;
  }

  if (!contract && !precontractId) throw new Error('Informe contractId ou precontractId.');

  const targetPrecontractId = contract?.precontract_id || precontractId || null;
  if (!targetPrecontractId) throw new Error('PrecontractId não encontrado.');

  const { data: precontract, error: preError } = await supabase.from('precontracts').select('*').eq('id', targetPrecontractId).single();
  if (preError) throw new Error(`Erro ao buscar precontract: ${preError.message}`);

  let contact = null;
  const targetContactId = contract?.contact_id || precontract?.contact_id || null;
  if (targetContactId) {
    const { data, error } = await supabase.from('contacts').select('*').eq('id', targetContactId).maybeSingle();
    if (error) throw new Error(`Erro ao buscar contact: ${error.message}`);
    contact = data || null;
  }

  let event = null;
  const targetEventId = contract?.event_id || precontract?.event_id || null;
  if (targetEventId) {
    const { data, error } = await supabase.from('events').select('*').eq('id', targetEventId).maybeSingle();
    if (error) throw new Error(`Erro ao buscar event: ${error.message}`);
    event = data || null;
  }

  return { contract, precontract, contact, event };
}

function getContractName(context) {
  const clientName = context.contact?.name || context.precontract?.client_name || context.event?.client_name || 'Cliente';
  const eventDate = context.event?.event_date || context.precontract?.event_date || new Date().toISOString().slice(0, 10);
  return `Contrato - ${clientName} - ${eventDate}`;
}

async function callContractService({ contractServiceUrl, contractServiceApiKey, payload }) {
  const baseUrl = String(contractServiceUrl || '').trim().replace(/\/+$/, '');
  const endpoint = `${baseUrl}/api/contracts/generate`;

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(contractServiceApiKey ? { 'x-api-key': contractServiceApiKey } : {}),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
  } catch (error) {
    throw new Error(`Falha ao conectar ao contract service: ${error?.message || 'erro desconhecido'}`);
  }

  let serviceJson = null;
  try {
    serviceJson = await response.json();
  } catch {
    throw new Error(`Contract service respondeu com payload inválido (status ${response.status}).`);
  }

  if (!response.ok || !serviceJson?.ok) {
    throw new Error(serviceJson?.message || `Contract service falhou com status ${response.status}.`);
  }

  return serviceJson;
}

function normalizeGeneratedResult(serviceJson) {
  const docUrl = serviceJson?.docUrl || serviceJson?.doc_url || serviceJson?.data?.docUrl || serviceJson?.data?.doc_url || null;
  const pdfUrl = serviceJson?.pdfUrl || serviceJson?.pdf_url || serviceJson?.data?.pdfUrl || serviceJson?.data?.pdf_url || null;
  return { ...serviceJson, docUrl, pdfUrl };
}

export async function generateContractDocument({ supabase, contractId, precontractId, previewOnly = false }) {
  const context = await getContractContext({ contractId, precontractId, supabase });
  const templateData = buildContractTemplateData(context);

  const isInternal =
    context.precontract?.custom_contract_enabled === true ||
    context.precontract?.contract_mode === 'internal';

  if (isInternal) {
    const internal = generateInternalContract(context, templateData);
    return {
      ok: true,
      mode: 'internal',
      html: internal.html,
      ids: {
        contractId: context.contract?.id || null,
        precontractId: context.precontract?.id || null,
        contactId: context.contact?.id || null,
        eventId: context.event?.id || null,
      },
      templateData,
      context,
    };
  }

  const googleDocsEnv = validateGoogleDocsEnv();
  if (!googleDocsEnv.valid) {
    return { ok: false, status: 500, message: googleDocsEnv.error, context };
  }

  if (previewOnly) {
    return {
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
      context,
    };
  }

  if (!context.contract?.id) {
    return {
      ok: false,
      status: 500,
      error: 'CONTRACT_NOT_FOUND_FOR_PRECONTRACT',
      message:
        'Tivemos uma instabilidade ao concluir seu contrato. Fique tranquilo: nossa equipe pode te ajudar rapidamente. Entre em contato conosco para finalizarmos isso juntos.',
      context,
    };
  }

  const { templateId, rootFolderId, contractServiceUrl, contractServiceApiKey } = googleDocsEnv;
  devLog('[generateContractDocument] env ok', { hasContractServiceApiKey: Boolean(contractServiceApiKey) });

  const contractName = getContractName(context);
  const eventDate = context.event?.event_date || context.precontract?.event_date || new Date().toISOString().slice(0, 10);

  let generated = await callContractService({
    contractServiceUrl,
    contractServiceApiKey,
    payload: { templateId, rootFolderId, templateData, contractName, eventDate, placeholderStyle: 'double_curly' },
  });

  generated = normalizeGeneratedResult(generated);
  if (!generated.docUrl || !generated.pdfUrl) {
    throw new Error('Contrato gerado sem links finais (docUrl/pdfUrl).');
  }

  const { error: updateError } = await supabase
    .from('contracts')
    .update({ doc_template_id: templateId, doc_url: generated.docUrl, pdf_url: generated.pdfUrl })
    .eq('id', context.contract.id);

  if (updateError) throw new Error(`Erro ao salvar links do contrato: ${updateError.message}`);

  return {
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
    context,
  };
}
