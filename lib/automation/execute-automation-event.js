import { resolveWorkspaceSettings } from './get-workspace';
import { getActiveRules } from './get-active-rules';
import { getChannel } from './get-channel';
import { resolveRecipient } from './resolve-recipient';
import { buildAutomationContext } from './build-automation-context';
import { checkAutomationDuplicate } from './check-automation-duplicate';
import { logAutomationDispatch } from './log-dispatch';
import { sendWhatsAppMessage } from '../whatsapp/send-whatsapp-message';
import { buildInviteMessage } from '../whatsapp/build-invite-message';
import { buildContractSignedMessage } from '../whatsapp/build-contract-signed-message';
import { getSupabaseAdmin } from '../supabase-admin';

const SUPPORTED_EVENT_TYPES = [
  'invite_member',
  'contract_signed_client',
  'repertoire_pending_15_days_client',
  'payment_pending_2_days_client',
  'post_event_review_request_client',
  'schedule_pending_15_days_admin',
];

/**
 * Resolve o tipo de entidade para logging baseado no tipo de evento
 */
function resolveEntityType(eventType) {
  switch (eventType) {
    case 'invite_member':
      return 'invite';
    case 'contract_signed_client':
      return 'contract';
    case 'repertoire_pending_15_days_client':
    case 'payment_pending_2_days_client':
    case 'post_event_review_request_client':
    case 'schedule_pending_15_days_admin':
      return 'event';
    default:
      return 'unknown';
  }
}

/**
 * Renderiza mensagem a partir de template dinâmico ou fallback para builders legados
 */
function renderTemplate(templateBody, context) {
  let rendered = templateBody;
  for (const [key, value] of Object.entries(context)) {
    rendered = rendered.replaceAll(key, value ?? '');
  }
  return rendered;
}

/**
 * Busca template por ID se existir
 */
async function fetchTemplateById(templateId) {
  if (!templateId) return null;
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('message_templates')
      .select('id, name, key, body, is_active')
      .eq('id', templateId)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Gera mensagem final: usa template do banco se disponível, senão fallback para builders legados
 */
async function resolveMessage(eventType, rule, recipientData, context) {
  // Tentar usar template do banco
  if (rule.template_id) {
    const template = await fetchTemplateById(rule.template_id);
    if (template?.body) {
      return {
        message: renderTemplate(template.body, context),
        templateId: template.id,
      };
    }
  }

  // Fallback para builders legados
  if (eventType === 'invite_member') {
    const { invite } = recipientData.contextData || {};
    const inviteLink =
      context['{link_painel_membro}'] ||
      context['{link_convite}'] ||
      context['{link_painel_cliente}'] ||
      '';
    const message = buildInviteMessage({
      contactName: invite?.contact?.name,
      event: invite?.event,
      inviteLink,
      role: invite?.suggested_role_name,
    });
    return { message, templateId: null };
  }

  if (eventType === 'contract_signed_client') {
    const { precontract } = recipientData.contextData || {};
    const clientPanelUrl = context['{link_painel_cliente}'] || '';
    const message = buildContractSignedMessage({
      clientName: precontract?.client_name,
      clientPanelUrl,
    });
    return { message, templateId: null };
  }

  // Fallback genérico para tipos baseados em evento
  if (eventType === 'repertoire_pending_15_days_client') {
    const clienteName = context['{cliente_nome}'] || 'Cliente';
    const eventDate = context['{evento_data}'] || '';
    const link = context['{link_painel_cliente}'] || '';
    const message =
      `Olá, ${clienteName}! Faltam 15 dias para o seu evento (${eventDate}). ` +
      `Por favor, acesse o painel e finalize a escolha do repertório: ${link}`;
    return { message, templateId: null };
  }

  if (eventType === 'payment_pending_2_days_client') {
    const clienteName = context['{cliente_nome}'] || 'Cliente';
    const eventDate = context['{evento_data}'] || '';
    const link = context['{link_painel_cliente}'] || '';
    const message =
      `Olá, ${clienteName}! Faltam 2 dias para o seu evento (${eventDate}) e identificamos um saldo pendente. ` +
      `Acesse seu painel para regularizar: ${link}`;
    return { message, templateId: null };
  }

  if (eventType === 'post_event_review_request_client') {
    const clienteName = context['{cliente_nome}'] || 'Cliente';
    const link = context['{link_painel_cliente}'] || '';
    const message =
      `Olá, ${clienteName}! Esperamos que o seu evento tenha sido incrível. ` +
      `Deixe sua avaliação e nos ajude a melhorar: ${link}`;
    return { message, templateId: null };
  }

  if (eventType === 'schedule_pending_15_days_admin') {
    const eventNome = context['{evento_nome}'] || 'Evento';
    const eventDate = context['{evento_data}'] || '';
    const pendencias = context['{pendencias_escala}'] || '?';
    const link = context['{link_admin}'] || '';
    const message =
      `[Harmonics] Lembrete: o evento "${eventNome}" (${eventDate}) tem ${pendencias} convite(s) pendente(s) na escala. ` +
      `Acesse: ${link}`;
    return { message, templateId: null };
  }

  throw new Error('Não foi possível gerar mensagem para o evento');
}

/**
 * Executa um evento de automação sob demanda.
 *
 * Motor central de execução: encontra regras ativas, resolve destinatário,
 * renderiza mensagem, envia via WhatsApp e registra log.
 *
 * @param {Object} params
 * @param {string} params.eventType - Tipo do evento (ex: 'invite_member')
 * @param {string} params.entityId  - ID da entidade relacionada (invite.id, precontract.id, etc.)
 * @param {string|null} [params.workspaceId] - ID do workspace (usa padrão se omitido)
 * @returns {Promise<{ ok: boolean, executions: Array, sent: number, skipped: number, failed: number, message?: string }>}
 */
export async function executeAutomationEvent({ eventType, entityId, workspaceId: inputWorkspaceId }) {
  console.info('[automation][event] started', {
    eventType,
    entityId,
    workspaceId: inputWorkspaceId || null,
  });

  if (!SUPPORTED_EVENT_TYPES.includes(eventType)) {
    throw new Error(`Event type not supported yet. Supported: ${SUPPORTED_EVENT_TYPES.join(', ')}`);
  }

  // Resolver workspaceId
  const workspaceId = (await resolveWorkspaceSettings(inputWorkspaceId)).id;
  console.info('[automation][event] workspace_resolved', { eventType, entityId, workspaceId });

  // Buscar regras ativas para este evento
  const rules = await getActiveRules(workspaceId, eventType);
  console.info('[automation][event] rules_resolved', {
    eventType,
    entityId,
    workspaceId,
    rulesCount: rules.length,
    ruleIds: rules.map((rule) => rule.id),
  });

  if (rules.length === 0) {
    return {
      ok: true,
      executions: [],
      skipped: 0,
      failed: 0,
      sent: 0,
      message: 'Nenhuma regra ativa encontrada para este evento',
    };
  }

  let recipientData;
  let context;
  try {
    // Resolver destinatário (uma vez para todas as regras)
    recipientData = await resolveRecipient(eventType, entityId, rules[0]);
    console.info('[automation][event] recipient_resolved', {
      eventType,
      entityId,
      recipientType: recipientData?.recipientType || null,
      recipientNumber: recipientData?.recipientNumber || null,
    });

    // Montar contexto de variáveis
    context = await buildAutomationContext(eventType, entityId, recipientData);
    console.info('[automation][event] context_built', {
      eventType,
      entityId,
      contextKeys: Object.keys(context || {}),
    });
  } catch (preflightError) {
    console.error('[automation][event] preflight_failed', {
      eventType,
      entityId,
      workspaceId,
      error: preflightError?.message || 'Erro desconhecido',
    });

    for (const rule of rules) {
      await logAutomationDispatch({
        workspaceId,
        ruleId: rule.id,
        templateId: rule.template_id || null,
        channelId: rule.channel_id || null,
        entityId,
        entityType: resolveEntityType(eventType),
        recipientType: null,
        recipient: null,
        renderedMessage: null,
        metadata: {
          eventType,
          entityId,
          stage: 'preflight',
        },
        providerResponse: null,
        status: 'failed',
        errorMessage: preflightError?.message || 'Erro desconhecido',
        source: 'automation_center',
      });
    }

    return {
      ok: true,
      executions: rules.map((rule) => ({
        ruleId: rule.id,
        ruleName: rule.name,
        status: 'failed',
        recipient: null,
        error: preflightError?.message || 'Erro desconhecido',
      })),
      skipped: 0,
      failed: rules.length,
      sent: 0,
      message: preflightError?.message || 'Erro no pré-processamento da automação',
    };
  }

  const executions = [];
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const rule of rules) {
    const executionResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      status: null,
      recipient: recipientData.recipientNumber,
      error: null,
    };

    try {
      // Verificar duplicidade
      const isDuplicate = await checkAutomationDuplicate(
        workspaceId,
        rule.id,
        entityId,
        recipientData.recipientNumber
      );

      if (isDuplicate) {
        executionResult.status = 'skipped';
        executionResult.error = 'Mensagem já enviada anteriormente (duplicidade)';
        skippedCount++;
        executions.push(executionResult);
        continue;
      }

      // Resolver canal (opcional — fallback para env vars ocorre internamente em sendWhatsAppMessage)
      let channelId = rule.channel_id || null;
      let selectedChannel = null;
      if (channelId) {
        selectedChannel = await getChannel(workspaceId, channelId);
        if (!selectedChannel) {
          // Canal configurado não encontrado/inativo — usará fallback das env vars
          channelId = null;
        }
      }
      console.info('[automation][event] channel_resolved', {
        eventType,
        entityId,
        ruleId: rule.id,
        channelRequestedId: rule.channel_id || null,
        channelResolvedId: channelId,
        channelFound: !!selectedChannel,
      });

      // Resolver mensagem
      const { message, templateId } = await resolveMessage(
        eventType,
        rule,
        recipientData,
        context
      );
      console.info('[automation][event] template_resolved', {
        eventType,
        entityId,
        ruleId: rule.id,
        ruleTemplateId: rule.template_id || null,
        templateResolvedId: templateId || null,
        usedFallbackTemplate: !templateId,
      });

      // Enviar mensagem
      console.info('[automation][event] provider_call_started', {
        eventType,
        entityId,
        ruleId: rule.id,
        recipient: recipientData.recipientNumber,
      });
      const providerResponse = await sendWhatsAppMessage({
        to: recipientData.recipientNumber,
        message,
        channel: selectedChannel,
      });
      console.info('[automation][event] provider_call_succeeded', {
        eventType,
        entityId,
        ruleId: rule.id,
        providerResponse,
      });

      // Registrar log de sucesso
      const logResult = await logAutomationDispatch({
        workspaceId,
        ruleId: rule.id,
        templateId: templateId || rule.template_id || null,
        channelId: channelId || null,
        entityId,
        entityType: resolveEntityType(eventType),
        recipientType: recipientData.recipientType,
        recipient: recipientData.recipientNumber,
        renderedMessage: message,
        metadata: {
          eventType,
          entityId,
          recipientName: recipientData.recipientName,
          contextData: recipientData.contextData,
        },
        providerResponse,
        status: 'sent',
        errorMessage: null,
        source: 'automation_center',
      });
      console.info('[automation][event] dispatch_logged', {
        eventType,
        entityId,
        ruleId: rule.id,
        status: 'sent',
        logOk: !!logResult?.ok,
      });

      executionResult.status = 'sent';
      sentCount++;
    } catch (err) {
      console.error(`[executeAutomationEvent] Erro na regra ${rule.id}:`, err);

      // Registrar log de falha
      const logResult = await logAutomationDispatch({
        workspaceId,
        ruleId: rule.id,
        templateId: rule.template_id || null,
        channelId: rule.channel_id || null,
        entityId,
        entityType: resolveEntityType(eventType),
        recipientType: recipientData?.recipientType || null,
        recipient: recipientData?.recipientNumber || null,
        renderedMessage: null,
        metadata: { eventType, entityId, error: err?.message },
        providerResponse: null,
        status: 'failed',
        errorMessage: err?.message || 'Erro desconhecido',
        source: 'automation_center',
      });
      console.info('[automation][event] dispatch_logged', {
        eventType,
        entityId,
        ruleId: rule.id,
        status: 'failed',
        logOk: !!logResult?.ok,
      });

      executionResult.status = 'failed';
      executionResult.error = err?.message || 'Erro desconhecido';
      failedCount++;
    }

    executions.push(executionResult);
  }

  return {
    ok: true,
    executions,
    skipped: skippedCount,
    failed: failedCount,
    sent: sentCount,
  };
}
