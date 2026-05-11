import { resolveWorkspaceSettings } from './get-workspace';
import { getActiveRules } from './get-active-rules';
import { getChannel } from './get-channel';
import { resolveRecipient } from './resolve-recipient';
import { buildAutomationContext } from './build-automation-context';
import { checkAutomationDuplicate } from './check-automation-duplicate';
import { safeLogDispatch } from './log-dispatch';
import { sendWhatsAppMessage } from '../whatsapp/send-whatsapp-message';
import { buildInviteMessage } from '../whatsapp/build-invite-message';
import { buildContractSignedMessage } from '../whatsapp/build-contract-signed-message';
import { getSupabaseAdmin } from '../supabase-admin';
import { renderTemplate } from './render-template';
import { ensureDefaultAutomations } from './ensure-defaults';

const SUPPORTED_EVENT_TYPES = [
  'invite_member',
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

function resolveEntityType(eventType) {
  switch (eventType) {
    case 'invite_member':
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
      console.info('[template][debug]', {
        templateOriginal: template.body,
        context: mergedContext,
        finalMessage,
      });
      return {
        message: finalMessage,
        templateId: template.id,
      };
    }
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

export async function executeAutomationEvent({ eventType, entityId, workspaceId: inputWorkspaceId }) {
  console.info('[automation][step] execute_automation_event_started', {
    eventType,
    entityId,
    workspaceId: inputWorkspaceId || null,
  });

  if (!SUPPORTED_EVENT_TYPES.includes(eventType)) {
    throw new Error(`Event type not supported yet. Supported: ${SUPPORTED_EVENT_TYPES.join(', ')}`);
  }

  const workspaceSettings = await resolveWorkspaceSettings(inputWorkspaceId);
  const workspaceId = normalizeId(workspaceSettings?.workspace_id || inputWorkspaceId || workspaceSettings?.id);
  const workspaceSettingsId = normalizeId(workspaceSettings?.id);

  if (!workspaceId) {
    throw new Error('Workspace real da automação não resolvido.');
  }

  await ensureDefaultAutomations(workspaceId);
  console.info('[automation][step] workspace_resolved', {
    eventType,
    entityId,
    workspaceId,
    workspaceSettingsId,
  });

  const rules = await getActiveRules(workspaceId, eventType);
  console.info('[automation][step] rules_resolved', {
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

  let recipientData;
  let context;
  try {
    recipientData = await resolveRecipient(eventType, entityId, rules[0]);
    console.info('[automation][step] recipient_resolved', {
      eventType,
      entityId,
      recipientType: recipientData?.recipientType || null,
      recipientNumber: recipientData?.recipientNumber || null,
    });

    context = await buildAutomationContext(eventType, entityId, recipientData);
    console.info('[automation][step] context_built', {
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
        recipientType: null,
        recipient: null,
        renderedMessage: null,
        metadata: {
          eventType,
          entityId,
          stage: 'preflight',
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

  for (const rule of rules) {
    const executionResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      status: null,
      recipient: recipientData.recipientNumber,
      error: null,
    };

    try {
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

      let channelId = rule.channel_id || null;
      let selectedChannel = null;
      if (channelId) {
        selectedChannel = await getChannel(workspaceId, channelId);
        if (!selectedChannel) {
          channelId = null;
        }
      }
      console.info('[automation][step] channel_resolved', {
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
      console.info('[automation][step] template_resolved', {
        eventType,
        entityId,
        ruleId: rule.id,
        ruleTemplateId: rule.template_id || null,
        templateResolvedId: templateId || null,
        usedFallbackTemplate: !templateId,
      });
      console.log('[AUTOMATION][WHATSAPP_RENDERED_MESSAGE]', {
        eventType,
        ruleId: rule.id,
        entityId,
        message,
      });
      console.log('[AUTOMATION][WHATSAPP_TARGET_PHONE]', {
        eventType,
        ruleId: rule.id,
        entityId,
        phone: recipientData.recipientNumber,
      });

      console.info('[automation][step] provider_call_started', {
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
      console.info('[automation][step] provider_call_succeeded', {
        eventType,
        entityId,
        ruleId: rule.id,
        providerResponse,
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
        metadata: {
          eventType,
          entityId,
          recipientName: recipientData.recipientName,
          contextData: recipientData.contextData,
          workspaceSettingsId,
        },
        providerResponse,
        status: 'sent',
        errorMessage: null,
        source: eventType,
      });
      console.info('[automation][step] dispatch_logged', {
        eventType,
        entityId,
        ruleId: rule.id,
        status: 'sent',
        logOk: !!logResult?.ok,
      });

      executionResult.status = 'sent';
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
        metadata: { eventType, entityId, error: err?.message, workspaceSettingsId },
        providerResponse: null,
        status: 'failed',
        errorMessage: err?.message || 'Erro desconhecido',
        source: eventType,
      });
      console.info('[automation][step] dispatch_logged', {
        eventType,
        entityId,
        ruleId: rule.id,
        status: 'failed',
        logOk: !!logResult?.ok,
      });

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
