import { buildContractTemplateData } from './buildContractTemplateData';
import { generateInternalContract } from './internalContractGenerator';

const IS_DEV = process.env.NODE_ENV !== 'production';
const DEFAULT_HYBRID_WORKSPACE_SLUGS = 'harmonics-producao,default,harmonics';

function devLog(message, payload) {
  if (!IS_DEV) return;
  if (payload === undefined) {
    console.info(message);
    return;
  }
  console.info(message, payload);
}

function asString(value) {
  return String(value || '').trim();
}

function normalizeKey(value) {
  return asString(value).toLowerCase();
}

function getHybridWorkspaceKeys() {
  return String(process.env.HARMONICS_HYBRID_WORKSPACE_SLUGS || DEFAULT_HYBRID_WORKSPACE_SLUGS)
    .split(',')
    .map((item) => normalizeKey(item))
    .filter(Boolean);
}

function isMissingColumnError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();

  return (
    code === '42703' ||
    message.includes('does not exist') ||
    message.includes('could not find the') ||
    details.includes('schema cache')
  );
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

async function getWorkspaceForContract({ supabase, context }) {
  const workspaceId = context?.precontract?.workspace_id || context?.contract?.workspace_id || context?.event?.workspace_id || null;
  if (!workspaceId) return null;

  let response = await supabase
    .from('workspaces')
    .select('id, name, slug, key, status, plan_key')
    .eq('id', workspaceId)
    .maybeSingle();

  if (response.error && isMissingColumnError(response.error)) {
    response = await supabase
      .from('workspaces')
      .select('id, name, key, is_active')
      .eq('id', workspaceId)
      .maybeSingle();
  }

  if (response.error) {
    console.warn('[CONTRACT_ENGINE][WORKSPACE_LOOKUP_ERROR]', {
      workspaceId,
      message: response.error?.message,
      code: response.error?.code,
    });
    return { id: workspaceId };
  }

  return response.data || { id: workspaceId };
}

async function getWorkspaceSettingsForContract({ supabase, workspaceId }) {
  if (!workspaceId) return null;

  let response = await supabase
    .from('workspace_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (response.error && isMissingColumnError(response.error)) {
    response = await supabase
      .from('workspace_settings')
      .select('*')
      .eq('id', workspaceId)
      .maybeSingle();
  }

  if (response.error && isMissingColumnError(response.error)) return null;

  if (response.error) {
    console.warn('[CONTRACT_ENGINE][SETTINGS_LOOKUP_ERROR]', {
      workspaceId,
      message: response.error?.message,
      code: response.error?.code,
    });
    return null;
  }

  return response.data || null;
}

async function resolveContractEngine({ supabase, context }) {
  const workspace = await getWorkspaceForContract({ supabase, context });
  const workspaceId = workspace?.id || context?.precontract?.workspace_id || context?.contract?.workspace_id || null;
  const settings = await getWorkspaceSettingsForContract({ supabase, workspaceId });

  const explicitEngine = normalizeKey(settings?.contract_engine || workspace?.contract_engine);
  if (['internal', 'google', 'hybrid'].includes(explicitEngine)) {
    return { engine: explicitEngine, workspace, settings, source: 'settings' };
  }

  const workspaceKeys = [workspace?.slug, workspace?.key, workspace?.name]
    .map((item) => normalizeKey(item))
    .filter(Boolean);
  const hybridKeys = getHybridWorkspaceKeys();
  const isHybridWorkspace = workspaceKeys.some((item) => hybridKeys.includes(item));

  return {
    engine: isHybridWorkspace ? 'hybrid' : 'internal',
    workspace,
    settings,
    source: isHybridWorkspace ? 'private_hybrid_workspace' : 'saas_default_internal',
  };
}

function shouldUseInternalEngine({ engine, context }) {
  if (engine === 'internal') return true;
  if (engine === 'google') return false;

  return (
    context.precontract?.custom_contract_enabled === true ||
    context.precontract?.contract_mode === 'internal'
  );
}

function getContractName(context) {
  const clientName = context.contact?.name || context.precontract?.client_name || context.event?.client_name || 'Cliente';
  const eventDate = context.event?.event_date || context.precontract?.event_date || new Date().toISOString().slice(0, 10);
  return `Contrato - ${clientName} - ${eventDate}`;
}

function buildInternalResult({ context, templateData, engineContext, fallbackReason = null }) {
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
    engine: engineContext.engine,
    fallbackReason,
  };
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
  const engineContext = await resolveContractEngine({ supabase, context });
  const isInternal = shouldUseInternalEngine({ engine: engineContext.engine, context });
  const canFallbackToInternal = engineContext.engine === 'hybrid' && !previewOnly;

  console.info('[CONTRACT_ENGINE_RESOLVED]', {
    engine: engineContext.engine,
    source: engineContext.source,
    workspaceId: engineContext.workspace?.id || context?.precontract?.workspace_id || null,
    workspaceSlug: engineContext.workspace?.slug || engineContext.workspace?.key || null,
    precontractId: context.precontract?.id || null,
    contractId: context.contract?.id || null,
    isInternal,
    canFallbackToInternal,
  });

  if (isInternal) {
    return buildInternalResult({ context, templateData, engineContext });
  }

  const googleDocsEnv = validateGoogleDocsEnv();
  if (!googleDocsEnv.valid) {
    if (canFallbackToInternal) {
      console.warn('[CONTRACT_ENGINE][GOOGLE_ENV_INVALID_FALLBACK_INTERNAL]', {
        message: googleDocsEnv.error,
        precontractId: context.precontract?.id || null,
        contractId: context.contract?.id || null,
      });
      return buildInternalResult({
        context,
        templateData,
        engineContext,
        fallbackReason: googleDocsEnv.error,
      });
    }

    return { ok: false, status: 500, message: googleDocsEnv.error, context, engine: engineContext.engine };
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
      engine: engineContext.engine,
    };
  }

  if (!context.contract?.id) {
    if (canFallbackToInternal) {
      console.warn('[CONTRACT_ENGINE][MISSING_CONTRACT_FALLBACK_INTERNAL]', {
        precontractId: context.precontract?.id || null,
      });
      return buildInternalResult({
        context,
        templateData,
        engineContext,
        fallbackReason: 'CONTRACT_NOT_FOUND_FOR_PRECONTRACT',
      });
    }

    return {
      ok: false,
      status: 500,
      error: 'CONTRACT_NOT_FOUND_FOR_PRECONTRACT',
      message:
        'Tivemos uma instabilidade ao concluir seu contrato. Fique tranquilo: nossa equipe pode te ajudar rapidamente. Entre em contato conosco para finalizarmos isso juntos.',
      context,
      engine: engineContext.engine,
    };
  }

  const { templateId, rootFolderId, contractServiceUrl, contractServiceApiKey } = googleDocsEnv;
  devLog('[generateContractDocument] env ok', { hasContractServiceApiKey: Boolean(contractServiceApiKey) });

  const contractName = getContractName(context);
  const eventDate = context.event?.event_date || context.precontract?.event_date || new Date().toISOString().slice(0, 10);

  try {
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
      engine: engineContext.engine,
    };
  } catch (error) {
    if (canFallbackToInternal) {
      console.error('[CONTRACT_ENGINE][GOOGLE_GENERATION_FAILED_FALLBACK_INTERNAL]', {
        message: error?.message || String(error),
        precontractId: context.precontract?.id || null,
        contractId: context.contract?.id || null,
        workspaceId: engineContext.workspace?.id || context?.precontract?.workspace_id || null,
      });

      return buildInternalResult({
        context,
        templateData,
        engineContext,
        fallbackReason: error?.message || 'Falha na geração Google/Drive.',
      });
    }

    throw error;
  }
}
