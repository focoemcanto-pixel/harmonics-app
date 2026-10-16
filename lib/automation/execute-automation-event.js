import { resolveWorkspaceSettings } from './get-workspace';
import { getActiveRules } from './get-active-rules';
import { getChannel } from './get-channel';
import { resolveRecipient } from './resolve-recipient';
import { buildAutomationContext } from './build-automation-context';
import { checkAutomationDuplicate } from './check-automation-duplicate';
import { safeLogDispatch } from './log-dispatch';
import { checkRecipientBeforeSend, shouldGuardRecipient } from './recipient-guard';
import { sendWhatsAppMessage } from '../whatsapp/send-whatsapp-message';
import { buildInviteMessage } from '../whatsapp/build-invite-message';
import { buildContractSignedMessage } from '../whatsapp/build-contract-signed-message';
import { getSupabaseAdmin } from '../supabase-admin';
import { renderTemplate } from './render-template';
import { ensureDefaultAutomations } from './ensure-defaults';
import {
  INVITE_EVENT_TYPE,
  INVITE_REMINDER_EVENT_TYPE,
  buildInviteReminderMessage,
  extractProviderMessageId,
  isInviteEventType,
  selectRulesForDispatch,
} from './invite-dispatch';
import { buildDedupeKey, loadDispatchRefs, normalizeStageKey } from './dispatch-identity';
import { acquireDispatchClaim, finishDispatchClaim } from './dispatch-claims';

const SUPPORTED_EVENT_TYPES = [
  'invite_member',
  'schedule_no_response_member',
  'contract_signed_client',
  'contract_signed_admin',
  'contract_review_released_client',
  'repertoire_review_released_client',
  'event_day_confirmation_client',
  'repertoire_pending_15_days_client',
  'payment_pending_2_days_client',
  'post_event_review_request_client',
  'schedule_pending_15_days_admin',
];

function shouldLogAutomationDebug() {
  return process.env.AUTOMATION_DEBUG === 'true';
}

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length <= 4) return digits ? '****' : null;
  return `${'*'.repeat(Math.max(digits.length - 4, 4))}${digits.slice(-4)}`;
}

function debugAutomationLog(label, payload) {
  if (!shouldLogAutomationDebug()) return;
  console.info(label, payload);
}

function resolveEntityType(eventType) {
  switch (eventType) {
    case 'invite_member':
    case 'schedule_no_response_member':
      return 'invite';
    case 'contract_signed_client':
    case 'contract_signed_admin':
    case 'contract_review_released_client':
      return 'contract';
    case 'repertoire_review_released_client':
    case 'event_day_confirmation_client':
    case 'repertoire_pending_15_days_client':
    case 'payment_pending_2_days_client':
    case 'post_event_review_request_client':
    case 'schedule_pending_15_days_admin':
      return 'event';
    default:
      return 'unknown';
  }
}

function normalizeId(value) {
  return String(value || '').trim() || null;
}

async function inferAutomationWorkspaceFromEntity(eventType, entityId) {
  const supabaseAdmin = getSupabaseAdmin();
  const safeEntityId = normalizeId(entityId);
  if (!safeEntityId) return null;

  try {
    if (isInviteEventType(eventType)) {
      const { data } = await supabaseAdmin
        .from('invites')
        .select('event:events(workspace_id)')
        .eq('id', safeEntityId)
        .maybeSingle();
      return normalizeId(data?.event?.workspace_id);
    }

    const eventTypes = new Set([
      'event_day_confirmation_client',
      'repertoire_pending_15_days_client',
      'payment_pending_2_days_client',
      'post_event_review_request_client',
      'schedule_pending_15_days_admin',
    ]);

    if (eventTypes.has(eventType)) {
      const { data } = await supabaseAdmin
        .from('events')
        .select('workspace_id')
        .eq('id', safeEntityId)
        .maybeSingle();
      return normalizeId(data?.workspace_id);
    }

    const { data: contract } = await supabaseAdmin
      .from('contracts')
      .select('event:events(workspace_id)')
      .eq('id', safeEntityId)
      .maybeSingle();
    const contractWorkspaceId = normalizeId(contract?.event?.workspace_id);
    if (contractWorkspaceId) return contractWorkspaceId;

    const { data: precontract } = await supabaseAdmin
      .from('precontracts')
      .select('event_id')
      .eq('id', safeEntityId)
      .maybeSingle();
    const eventId = normalizeId(precontract?.event_id);
    if (!eventId) return null;

    const { data: event } = await supabaseAdmin
      .from('events')
      .select('workspace_id')
      .eq('id', eventId)
      .maybeSingle();
    return normalizeId(event?.workspace_id);
  } catch (error) {
    console.warn('[automation][workspace] entity_inference_failed', {
      eventType,
      entityId: safeEntityId,
      error: error?.message || String(error),
    });
    return null;
  }
}

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

async function resolveMessage(eventType, rule, recipientData, context) {
  if (rule.template_id) {
    const template = await fetchTemplateById(rule.template_id);
    if (template?.body) {
      const invite = recipientData?.contextData?.invite;
      const event = invite?.event;
      const contact = invite?.contact;
      const inviteContext = {
        nome_musico: contact?.name || '',
        nome_membro: contact?.name || '',
        nome_empresa: 'Harmonics',
        evento_nome: event?.name || event?.client_name || '',
        evento_data: event?.date || context.evento_data || '',
        evento_horario: event?.time || context.evento_horario || '',
        evento_local: event?.location || event?.location_name || '',
        painel_membro: context?.link_painel_membro || context?.painel_membro || '',
        link_painel_membro: context?.link_painel_membro || '',
      };
      const mergedContext = {
        ...inviteContext,
        ...context,
      };
      const finalMessage = renderTemplate(template.body, mergedContext);
      debugAutomationLog('[template][debug]', {
        templateId: template.id,
        contextKeys: Object.keys(mergedContext || {}),
        finalMessageLength: finalMessage.length,
      });
      return {
        message: finalMessage,
        templateId: template.id,
      };
    }
  }

  if (eventType === INVITE_REMINDER_EVENT_TYPE) {
    const { invite } = recipientData.contextData || {};
    const message = buildInviteReminderMessage({
      contactName: invite?.contact?.name,
      eventName: context['{evento_nome}'] || invite?.event?.client_name || '',
      eventDate: context['{evento_data}'] || '',
      eventTime: context['{evento_horario}'] || '',
      memberPanelLink: context['{link_painel_membro}'] || '',
    });
    return { message, templateId: null };
  }

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
  if (eventType === 'contract_signed_admin') {
    const clientName = context['{cliente_nome}'] || 'Cliente';
    const eventDate = context['{evento_data}'] || '';
    const eventTime = context['{evento_horario}'] || '';
    const pdfUrl = context['{pdf_url}'] || context['{link_pdf}'] || '';
    const clientPanelUrl = context['{link_painel_cliente}'] || '';
    const message = `✅ Contrato assinado\nCliente: ${clientName}\nEvento: ${eventDate}${eventTime ? ` às ${eventTime}` : ''}\nLink do contrato/PDF: ${pdfUrl || '-'}\nPainel: ${clientPanelUrl || '-'}`;
    return { message, templateId: null };
  }

  if (eventType === 'contract_review_released_client') {
    const clientName = context['{cliente_nome}'] || 'Cliente';
    const contractLink = context['{link_contrato}'] || context['{contract_link}'] || '';
    const message = `Oi, ${clientName}! 💜\n\nSeu pedido de revisão do contrato foi concluído e já liberamos novamente para você revisar/seguir com o processo.\nVocê pode acessar por aqui: ${contractLink}\nQualquer dúvida, seguimos à disposição.`;
    return { message, templateId: null };
  }

  if (eventType === 'repertoire_review_released_client') {
    const clientName = context['{cliente_nome}'] || 'Cliente';
    const panelLink = context['{client_panel_link}'] || context['{link_painel_cliente}'] || '';
    const message = `Oi, ${clientName}! 💜\n\nSeu pedido de revisão do repertório foi aceito e já liberamos a edição novamente para você.\nVocê pode acessar seu painel por aqui: ${panelLink}\nSe precisar, seguimos por aqui.`;
    return { message, templateId: null };
  }

  if (eventType === 'event_day_confirmation_client') {
    const clientName = context['{cliente_nome}'] || 'Cliente';
    const eventTime = context['{event_time}'] || context['{evento_horario}'] || '--:--';
    const message = `Oi, ${clientName}! 💜\n\nÉ hoje o grande dia, e estamos muito felizes pela confiança em fazer parte desse momento tão especial.\n\nSó queremos confirmar com você se o horário previsto para o início da cerimônia continua sendo às ${eventTime}.\nNossa equipe se organiza para chegar com 2 horas de antecedência, e lembramos que atrasos superiores a 1 hora podem gerar multa contratual.\n\nSe puder, nos confirme por aqui se esse continua sendo o horário previsto.\nMuito obrigado e desejamos que seja um dia lindo e abençoado! ✨`;
    return { message, templateId: null };
  }

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
    const reviewLink =
      context['{review_link}'] || context['{link_review}'] || context['{link_painel_cliente}'] || '';
    const eventoNome = context['{evento_nome}'] || '';
    const eventoData = context['{evento_data}'] || '';
    const nomeEmpresa = context['{nome_empresa}'] || 'Harmonics';
    const message = `Oi, ${clienteName}! 😊\n\nPassando pra agradecer pela confiança no nosso trabalho${eventoNome ? ` no ${eventoNome}` : ''}${eventoData ? ` (${eventoData})` : ''}. Foi um privilégio fazer parte desse momento tão especial!\n\nSe puder, deixa seu depoimento pra gente 🙏\nIsso ajuda muito o nosso trabalho a alcançar mais pessoas.\n\n👉 ${reviewLink}\n\nDesejamos muito amor e felicidade nessa nova fase! 💜\n— ${nomeEmpresa}`;
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

function resolveInviteEventId(eventType, recipientData) {
  if (!isInviteEventType(eventType)) return null;
  const invite = recipientData?.contextData?.invite;
  return normalizeId(invite?.event_id || invite?.event?.id);
}

/**
 * @param {Object} params
 * @param {string} params.eventType
 * @param {string} params.entityId
 * @param {string} [params.workspaceId]
 * @param {string} [params.origin] - origem do disparo para os logs: 'immediate' | 'cron' | 'manual' | 'test'
 * @param {number} [params.attempt] - tentativa (lembrete de convite)
 * @param {string} [params.stageKey] - etapa do disparo na chave de idempotência (ex.: "adjustment:<id>")
 */
export async function executeAutomationEvent({ eventType, entityId, workspaceId: inputWorkspaceId, origin = null, attempt = null, stageKey = null }) {
  debugAutomationLog('[automation][step] execute_automation_event_started', {
    eventType,
    entityId,
    workspaceId: inputWorkspaceId || null,
  });

  if (!SUPPORTED_EVENT_TYPES.includes(eventType)) {
    throw new Error(`Event type not supported yet. Supported: ${SUPPORTED_EVENT_TYPES.join(', ')}`);
  }

  const suppliedWorkspaceId = normalizeId(inputWorkspaceId);
  const inferredWorkspaceId = suppliedWorkspaceId
    ? null
    : await inferAutomationWorkspaceFromEntity(eventType, entityId);
  const workspaceCandidate = suppliedWorkspaceId || inferredWorkspaceId;
  const workspaceInferenceSource = suppliedWorkspaceId
    ? 'caller'
    : inferredWorkspaceId
      ? 'entity'
      : 'unresolved';

  const workspaceSettings = await resolveWorkspaceSettings(workspaceCandidate);
  const workspaceId = normalizeId(
    workspaceSettings?.workspace_id || workspaceCandidate || workspaceSettings?.id
  );
  const workspaceSettingsId = normalizeId(workspaceSettings?.workspace_settings_id);

  if (!workspaceId) {
    console.error('[automation][workspace] unresolved', {
      eventType,
      entityId,
      suppliedWorkspaceId,
      inferredWorkspaceId,
    });
    throw new Error('Workspace real da automação não resolvido.');
  }

  debugAutomationLog('[automation][workspace] resolved', {
    eventType,
    entityId,
    workspaceId,
    workspaceSettingsId,
    workspaceInferenceSource,
  });

  await ensureDefaultAutomations(workspaceId);
  debugAutomationLog('[automation][step] workspace_resolved', {
    eventType,
    entityId,
    workspaceId,
    workspaceSettingsId,
  });

  const rules = selectRulesForDispatch(eventType, await getActiveRules(workspaceId, eventType));
  debugAutomationLog('[automation][step] rules_resolved', {
    eventType,
    entityId,
    workspaceId,
    workspaceSettingsId,
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

  // Convites (#743) têm identidade própria na tabela invites. Demais tipos: entidade
  // real (evento / pré-contrato / contrato) e chave de idempotência por regra + etapa.
  const isInvite = isInviteEventType(eventType);
  const stage = normalizeStageKey(stageKey);
  const dispatchRefs = isInvite
    ? null
    : await loadDispatchRefs({ supabase: getSupabaseAdmin(), eventType, entityId });

  if (dispatchRefs?.workspaceId && dispatchRefs.workspaceId !== workspaceId) {
    console.error('[automation][workspace] entity_workspace_mismatch', { eventType, entityId, workspaceId });
    return {
      ok: false,
      executions: rules.map((rule) => ({
        ruleId: rule.id,
        ruleName: rule.name,
        status: 'failed',
        recipient: null,
        error: 'Entidade pertence a outro workspace',
      })),
      skipped: 0,
      failed: rules.length,
      sent: 0,
      message: 'Entidade pertence a outro workspace',
    };
  }

  const entityLogRefs = dispatchRefs
    ? { eventId: dispatchRefs.eventId, precontractId: dispatchRefs.precontractId, contractId: dispatchRefs.contractId }
    : {};

  let recipientData;
  let context;
  try {
    // O lembrete de convite usa o mesmo destinatário e contexto do convite.
    const recipientEventType = isInviteEventType(eventType) ? INVITE_EVENT_TYPE : eventType;
    recipientData = await resolveRecipient(recipientEventType, entityId, rules[0]);
    debugAutomationLog('[automation][step] recipient_resolved', {
      eventType,
      entityId,
      recipientType: recipientData?.recipientType || null,
      recipientNumber: maskPhone(recipientData?.recipientNumber),
    });

    context = await buildAutomationContext(recipientEventType, entityId, recipientData);
    debugAutomationLog('[automation][step] context_built', {
      eventType,
      entityId,
      contextKeys: Object.keys(context || {}),
    });
  } catch (preflightError) {
    console.error('[automation][step] preflight_failed', {
      eventType,
      entityId,
      workspaceId,
      error: preflightError?.message || 'Erro desconhecido',
    });

    for (const rule of rules) {
      await safeLogDispatch({
        workspaceId,
        ruleId: rule.id,
        templateId: rule.template_id || null,
        channelId: rule.channel_id || null,
        entityId,
        entityType: resolveEntityType(eventType),
        ...entityLogRefs,
        recipientType: null,
        recipient: null,
        renderedMessage: null,
        metadata: {
          eventType,
          entityId,
          stage: 'preflight',
          stageKey: stage,
          origin,
          attempt,
          workspaceSettingsId,
        },
        providerResponse: null,
        status: 'failed',
        errorMessage: preflightError?.message || 'Erro desconhecido',
        source: eventType,
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

  if (eventType === 'post_event_review_request_client') {
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: existingReview } = await supabaseAdmin
        .from('client_reviews')
        .select('id')
        .eq('event_id', entityId)
        .maybeSingle();

      if (existingReview?.id) {
        return {
          ok: true,
          executions: rules.map((rule) => ({
            ruleId: rule.id,
            ruleName: rule.name,
            status: 'skipped',
            recipient: recipientData?.recipientNumber || null,
            error: 'Avaliação já enviada para este evento',
          })),
          skipped: rules.length,
          failed: 0,
          sent: 0,
          message: 'Avaliação já enviada para este evento',
        };
      }
    } catch (reviewCheckError) {
      console.warn('[automation][step] review_preflight_check_failed', {
        eventType,
        entityId,
        error: reviewCheckError?.message || 'Erro desconhecido',
      });
    }
  }

  const executions = [];
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const logRefs = isInvite ? { eventId: resolveInviteEventId(eventType, recipientData) } : entityLogRefs;

  for (const rule of rules) {
    let claim = null;
    const executionResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      status: null,
      recipient: recipientData.recipientNumber,
      error: null,
    };

    try {
      // Convites têm idempotência própria na tabela invites (lock + whatsapp_sent_at
      // para o convite; reminder_5d_* para o lembrete). Um log histórico "sent" não pode
      // bloquear um convite removido e reativado (mesmo ID, whatsapp_sent_at zerado).
      // Etapa explícita (ex.: cada liberação de revisão) não tem histórico em logs antigos:
      // a reserva atômica abaixo é a fonte de verdade dela.
      const isDuplicate = isInvite || stage
        ? false
        : await checkAutomationDuplicate({
            workspaceId,
            ruleId: rule.id,
            entityType: dispatchRefs?.entityType,
            refs: dispatchRefs || {},
            entityId,
            recipientNumber: recipientData.recipientNumber,
          });

      if (isDuplicate) {
        executionResult.status = 'skipped';
        executionResult.error = 'Mensagem já enviada anteriormente (duplicidade)';
        skippedCount++;
        executions.push(executionResult);
        continue;
      }

      const recipientCheck = shouldGuardRecipient(eventType)
        ? await checkRecipientBeforeSend({
            supabase: getSupabaseAdmin(),
            workspaceId,
            recipient: recipientData.recipientNumber,
          })
        : { ok: true };
      if (!recipientCheck.ok) {
        await safeLogDispatch({
          workspaceId,
          ruleId: rule.id,
          templateId: rule.template_id || null,
          channelId: rule.channel_id || null,
          entityId,
          entityType: resolveEntityType(eventType),
          recipientType: recipientData.recipientType,
          recipient: recipientData.recipientNumber,
          renderedMessage: null,
          ...logRefs,
          metadata: {
            eventType,
            entityId,
            stage: 'recipient_guard',
            origin,
            attempt,
            skipReason: recipientCheck.reason,
            previousLogId: recipientCheck.previousLogId || null,
            workspaceSettingsId,
          },
          providerResponse: null,
          status: 'skipped',
          errorMessage: recipientCheck.message,
          source: eventType,
        });
        executionResult.status = 'skipped';
        executionResult.error = recipientCheck.message;
        skippedCount++;
        executions.push(executionResult);
        continue;
      }

      const dedupeKey = isInvite
        ? null
        : buildDedupeKey({
            eventType,
            refs: dispatchRefs,
            ruleId: rule.id,
            stageKey: stage,
            recipient: recipientData.recipientNumber,
          });
      if (dedupeKey) {
        claim = await acquireDispatchClaim({
          supabase: getSupabaseAdmin(),
          workspaceId,
          dedupeKey,
          eventType,
          ruleId: rule.id,
          entityType: dispatchRefs?.entityType,
          entityId: dispatchRefs?.precontractId || dispatchRefs?.eventId || entityId,
        });
        if (!claim.acquired) {
          executionResult.status = 'skipped';
          executionResult.error = 'Mensagem já enviada ou em envio (duplicidade)';
          skippedCount++;
          executions.push(executionResult);
          continue;
        }
      }

      let channelId = rule.channel_id || null;
      let selectedChannel = null;
      if (channelId) {
        selectedChannel = await getChannel(workspaceId, channelId);
      }

      if (!selectedChannel) {
        selectedChannel = await getChannel(workspaceId);
      }

      if (selectedChannel) {
        channelId = selectedChannel.id;
      } else {
        channelId = null;
      }
      debugAutomationLog('[automation][step] channel_resolved', {
        eventType,
        entityId,
        ruleId: rule.id,
        channelRequestedId: rule.channel_id || null,
        channelResolvedId: channelId,
        channelFound: !!selectedChannel,
      });

      const { message, templateId } = await resolveMessage(
        eventType,
        rule,
        recipientData,
        context
      );
      debugAutomationLog('[automation][step] template_resolved', {
        eventType,
        entityId,
        ruleId: rule.id,
        ruleTemplateId: rule.template_id || null,
        templateResolvedId: templateId || null,
        usedFallbackTemplate: !templateId,
        messageLength: message.length,
      });

      debugAutomationLog('[automation][step] provider_call_started', {
        eventType,
        entityId,
        ruleId: rule.id,
        recipient: maskPhone(recipientData.recipientNumber),
      });
      const providerResponse = await sendWhatsAppMessage({
        to: recipientData.recipientNumber,
        message,
        channel: selectedChannel,
      });
      debugAutomationLog('[automation][step] provider_call_succeeded', {
        eventType,
        entityId,
        ruleId: rule.id,
        providerStatus: providerResponse?.status || providerResponse?.ok || null,
      });

      const logResult = await safeLogDispatch({
        workspaceId,
        ruleId: rule.id,
        templateId: templateId || rule.template_id || null,
        channelId: channelId || null,
        entityId,
        entityType: resolveEntityType(eventType),
        recipientType: recipientData.recipientType,
        recipient: recipientData.recipientNumber,
        renderedMessage: message,
        ...logRefs,
        metadata: {
          eventType,
          entityId,
          recipientName: recipientData.recipientName,
          contextData: recipientData.contextData,
          origin,
          attempt,
          stageKey: stage,
          dedupeKey: dedupeKey || null,
          providerMessageId: extractProviderMessageId(providerResponse),
          workspaceSettingsId,
        },
        providerResponse,
        status: 'sent',
        errorMessage: null,
        source: eventType,
      });
      debugAutomationLog('[automation][step] dispatch_logged', {
        eventType,
        entityId,
        ruleId: rule.id,
        status: 'sent',
        logOk: !!logResult?.ok,
      });

      await finishDispatchClaim({ supabase: getSupabaseAdmin(), claimId: claim?.claimId, status: 'sent', logId: logResult?.logId });

      executionResult.status = 'sent';
      executionResult.providerMessageId = extractProviderMessageId(providerResponse);
      sentCount++;
    } catch (err) {
      console.error('[automation][step] rule_execution_failed', {
        ruleId: rule.id,
        eventType,
        entityId,
        error: err?.message || 'Erro desconhecido',
      });

      const logResult = await safeLogDispatch({
        workspaceId,
        ruleId: rule.id,
        templateId: rule.template_id || null,
        channelId: rule.channel_id || null,
        entityId,
        entityType: resolveEntityType(eventType),
        recipientType: recipientData?.recipientType || null,
        recipient: recipientData?.recipientNumber || null,
        renderedMessage: null,
        ...logRefs,
        metadata: { eventType, entityId, error: err?.message, origin, attempt, stageKey: stage, workspaceSettingsId },
        providerResponse: null,
        status: 'failed',
        errorMessage: err?.message || 'Erro desconhecido',
        source: eventType,
      });
      debugAutomationLog('[automation][step] dispatch_logged', {
        eventType,
        entityId,
        ruleId: rule.id,
        status: 'failed',
        logOk: !!logResult?.ok,
      });

      // Provider recusou (ou erro antes do envio): libera a etapa para um retry.
      await finishDispatchClaim({ supabase: getSupabaseAdmin(), claimId: claim?.claimId, status: 'failed', error: err?.message });

      executionResult.status = 'failed';
      executionResult.error = err?.message || 'Erro desconhecido';
      executionResult.providerError = {
        provider: err?.provider || null,
        baseUrl: err?.providerBaseUrl || null,
        endpoint: err?.providerEndpoint || null,
        status: err?.providerStatus ?? null,
        response: err?.providerResponse || null,
      };
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
