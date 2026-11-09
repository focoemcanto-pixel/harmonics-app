/**
 * Orquestração do Inbox híbrido: ingestão de webhook, geração de resposta da IA e despacho.
 * Toda escrita sensível passa por RPCs transacionais (ver migration v2). Dependências de rede
 * (Meta, LLM) são injetáveis para teste.
 */
import { parseMetaWebhook, sha256Hex } from './meta-webhook.mjs';
import { decryptSecret } from './secret-box.mjs';
import { sendTextMessage, sendTemplateMessage, downloadMedia, isWithinCustomerServiceWindow } from './meta-client.mjs';
import { resolveAiGate, detectHandoffTrigger, sanitizeReply, handoffMessage, requiredToolFor, requiredQuoteTableFor, stripUnapprovedPaymentClaims } from '../agent/policy.mjs';
import { buildSystemPrompt, buildConversationInput, ensureFirstContactIntro } from '../agent/prompt.mjs';
import { TOOL_DEFINITIONS, executeTool } from '../agent/tools.mjs';
import { generateReply, transcribeAudio } from '../agent/llm.mjs';
import {
  handleOptOut, handleClosingReply, buildCommercialContext, applyCommercialEffects,
  markNeedsHumanWithSummary, resolveCustomerStatus,
} from '../commercial/engine.mjs';
import { observeHumanReply } from '../commercial/learning.mjs';
import { markLinkSent } from '../commercial/supervision.mjs';
import { traceAiReply, replyTraceAttributes } from '../commercial/observability.mjs';
import { createRouteFn } from '../../logistics/google-distance.mjs';

const first = (data) => (Array.isArray(data) ? data[0] : data) || null;

function defaultDeps(overrides = {}) {
  return {
    env: process.env,
    fetchImpl: (...args) => fetch(...args),
    generateReply,
    transcribeAudio,
    sendTextMessage,
    sendTemplateMessage,
    downloadMedia,
    routeFn: createRouteFn(),
    // Alerta ao responsável pelo canal administrativo existente (WaSender), só se habilitado.
    notifyAdmin: async (message, options) => (await import('../../whatsapp/send-admin-alert.js')).sendAdminWhatsAppAlert(message, options),
    now: () => Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Contexto de workspace
// ---------------------------------------------------------------------------
export async function loadWorkspaceAiContext(supabase, workspaceId) {
  const [settingsRes, channelRes, wsSettingsRes, wsRes] = await Promise.all([
    supabase.from('ai_workspace_settings').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    supabase.from('ai_channels').select('*').eq('workspace_id', workspaceId).eq('provider', 'meta_cloud').maybeSingle(),
    supabase.from('workspace_settings').select('company_name, public_name, client_panel_base_url').eq('workspace_id', workspaceId).maybeSingle(),
    supabase.from('workspaces').select('name').eq('id', workspaceId).maybeSingle(),
  ]);
  return {
    settings: settingsRes.data || null,
    channel: channelRes.data || null,
    companyName: wsSettingsRes.data?.public_name || wsSettingsRes.data?.company_name || wsRes.data?.name || null,
    clientPanelBaseUrl: wsSettingsRes.data?.client_panel_base_url || null,
  };
}

async function getChannelToken(channel, env) {
  if (!channel?.access_token_encrypted) throw new Error('channel_token_missing');
  return decryptSecret(channel.access_token_encrypted, env.AI_CHANNEL_ENCRYPTION_KEY);
}

// ---------------------------------------------------------------------------
// Ingestão
// ---------------------------------------------------------------------------
/**
 * Persiste o webhook de forma idempotente. Eventos de números não cadastrados são ignorados
 * (sem fallback entre tenants). Retorna as conversas que precisam de resposta da IA.
 */
export async function ingestWebhook({ supabase, rawBody, payload }) {
  const dedupeKey = await sha256Hex(rawBody);
  // Lote já processado => duplicado. Lote que falhou no meio (Meta reenvia) é reprocessado:
  // a idempotência por mensagem/status no banco torna o reprocessamento seguro.
  let { data: inserted, error: dedupeError } = await supabase
    .from('ai_webhook_events')
    .insert({ provider: 'meta_cloud', dedupe_key: dedupeKey, kind: 'batch' })
    .select('id')
    .maybeSingle();
  if (dedupeError) {
    if (dedupeError.code !== '23505') throw dedupeError;
    const { data: existing } = await supabase.from('ai_webhook_events').select('id, status')
      .eq('provider', 'meta_cloud').eq('dedupe_key', dedupeKey).maybeSingle();
    if (!existing || ['processed', 'ignored'].includes(existing.status)) return { duplicate: true, pending: [] };
    inserted = existing;
  }
  try {
    return await processWebhookEvents({ supabase, payload, eventRowId: inserted.id });
  } catch (error) {
    await supabase.from('ai_webhook_events').update({ status: 'failed', error: String(error?.code || error?.message || 'error').slice(0, 120) })
      .eq('id', inserted.id);
    throw error;
  }
}

async function processWebhookEvents({ supabase, payload, eventRowId }) {
  const events = parseMetaWebhook(payload);
  const channels = new Map();
  const pending = new Map();
  const stats = { messages: 0, duplicates: 0, statuses: 0, takeovers: 0, ignored: 0 };
  let workspaceId = null;

  for (const event of events) {
    if (!channels.has(event.phoneNumberId)) {
      const { data } = await supabase.from('ai_channels').select('id, workspace_id, status')
        .eq('phone_number_id', event.phoneNumberId).maybeSingle();
      channels.set(event.phoneNumberId, data || null);
    }
    const channel = channels.get(event.phoneNumberId);
    if (!channel) { stats.ignored += 1; continue; }
    workspaceId = channel.workspace_id;

    if (event.kind === 'message') {
      const { data, error } = await supabase.rpc('ai_ingest_message', {
        p_workspace_id: channel.workspace_id,
        p_provider_chat_id: event.chatId,
        p_provider_message_id: event.providerMessageId,
        p_direction: event.direction,
        p_origin: event.origin,
        p_message_type: event.messageType,
        p_content: event.content || null,
        p_media_id: event.mediaId,
        p_media_mime: event.mediaMime,
        p_provider_created_at: event.createdAt,
        p_contact_name: event.contactName || null,
      });
      if (error) throw error;
      const row = first(data);
      if (!row?.inserted) { stats.duplicates += 1; continue; }
      stats.messages += 1;
      if (row.took_over) stats.takeovers += 1;
      if (event.origin === 'business_app') {
        // Aprendizado supervisionado: resposta humana vira sugestão (nunca regra automática).
        try { await observeHumanReply({ supabase, workspaceId: channel.workspace_id, conversationId: row.conversation_id }); } catch { /* não bloqueia */ }
      }
      if (event.origin === 'customer' && row.owner === 'ai') {
        pending.set(row.conversation_id, { workspaceId: channel.workspace_id, conversationId: row.conversation_id });
      }
    } else if (event.kind === 'status') {
      await supabase.rpc('ai_apply_message_status', {
        p_workspace_id: channel.workspace_id,
        p_provider_message_id: event.providerMessageId,
        p_status: event.status,
        p_error_code: event.errorCode,
      });
      stats.statuses += 1;
    } else if (event.kind === 'contact' && event.name) {
      await supabase.from('ai_conversations').update({ contact_name: event.name })
        .eq('workspace_id', channel.workspace_id).eq('provider_chat_id', event.chatId).is('contact_name', null);
    } else if (event.kind === 'history_progress') {
      const status = event.error ? (event.error === '2593109' ? 'declined' : 'failed')
        : Number(event.progress) >= 100 ? 'completed' : 'in_progress';
      await supabase.from('ai_channels').update({ history_sync_status: status, updated_at: new Date().toISOString() })
        .eq('id', channel.id);
    }
  }

  for (const channel of channels.values()) {
    if (channel) await supabase.from('ai_channels').update({ last_webhook_at: new Date().toISOString() }).eq('id', channel.id);
  }
  await supabase.from('ai_webhook_events')
    .update({ status: events.length ? 'processed' : 'ignored', workspace_id: workspaceId, processed_at: new Date().toISOString() })
    .eq('id', eventRowId);

  return { duplicate: false, pending: [...pending.values()], stats };
}

// ---------------------------------------------------------------------------
// Resposta da IA
// ---------------------------------------------------------------------------
async function markNeedsHuman(supabase, workspaceId, conversationId, reason) {
  await supabase.from('ai_conversations')
    .update({ needs_human: true, needs_human_reason: reason, updated_at: new Date().toISOString() })
    .eq('id', conversationId).eq('workspace_id', workspaceId);
}

async function recordUsage(supabase, row) {
  const { error } = await supabase.from('ai_usage_ledger').insert(row);
  if (error) console.error('[AI][USAGE][ERROR]', { code: error.code });
}

async function transcribePendingAudio({ supabase, workspaceId, conversationId, messages, channel, deps }) {
  const audios = messages.filter((m) => m.direction === 'inbound' && m.message_type === 'audio' && m.media_id && !m.transcript);
  if (!audios.length) return;
  const token = await getChannelToken(channel, deps.env);
  for (const audio of audios.slice(-3)) {
    try {
      const media = await deps.downloadMedia({ mediaId: audio.media_id, token, fetchImpl: deps.fetchImpl });
      const result = await deps.transcribeAudio({ bytes: media.bytes, mime: media.mime, env: deps.env, fetchImpl: deps.fetchImpl });
      audio.transcript = result.text || '[áudio sem fala identificável]';
      await supabase.from('ai_messages').update({ transcript: audio.transcript }).eq('id', audio.id).eq('workspace_id', workspaceId);
      await recordUsage(supabase, { workspace_id: workspaceId, conversation_id: conversationId, kind: 'transcription', model: result.model, cost_usd: result.costUsd });
    } catch (error) {
      console.warn('[AI][TRANSCRIBE][FAILED]', { message: error?.message });
    }
  }
}

/**
 * Gera e enfileira a resposta da IA para uma conversa. Nunca envia diretamente:
 * o envio passa pelo claim transacional do outbox.
 */
export async function processConversationReply({ supabase, workspaceId, conversationId, deps: overrides } = {}) {
  const deps = defaultDeps(overrides);
  const ctx = await loadWorkspaceAiContext(supabase, workspaceId);
  const { data: usageRows } = await supabase.rpc('ai_usage_summary', { p_workspace_id: workspaceId });
  const usage = first(usageRows) || {};

  const { data: conversation } = await supabase.from('ai_conversations').select('*')
    .eq('id', conversationId).eq('workspace_id', workspaceId).maybeSingle();
  if (!conversation) return { status: 'skipped', reason: 'not_found' };

  const gate = resolveAiGate({ env: deps.env, settings: ctx.settings, channel: ctx.channel, conversation, usage });
  if (!gate.allowed) {
    if (gate.handoff) await markNeedsHuman(supabase, workspaceId, conversationId, gate.reason);
    // Não deixa a conversa presa na fila da IA enquanto ela estiver bloqueada.
    await supabase.from('ai_conversations').update({ ai_pending_since: null })
      .eq('id', conversationId).eq('workspace_id', workspaceId);
    return { status: 'skipped', reason: gate.reason };
  }

  const { data: claimRows, error: claimError } = await supabase.rpc('ai_claim_conversation_for_reply', {
    p_workspace_id: workspaceId, p_conversation_id: conversationId, p_lease_seconds: 90,
  });
  if (claimError) throw claimError;
  const claim = first(claimRows);
  if (!claim?.claimed) return { status: 'skipped', reason: 'not_claimed' };
  const ownerVersion = Number(claim.owner_version);

  try {
    const { data: recent } = await supabase.from('ai_messages').select('*')
      .eq('workspace_id', workspaceId).eq('conversation_id', conversationId)
      .order('created_at', { ascending: false }).limit(20);
    const messages = recent || [];
    const lastInbound = messages.find((m) => m.direction === 'inbound');
    if (!lastInbound) return { status: 'skipped', reason: 'no_inbound' };

    await transcribePendingAudio({ supabase, workspaceId, conversationId, messages, channel: ctx.channel, deps });

    const idempotencyKey = `ai:${conversationId}:${lastInbound.provider_message_id || lastInbound.id}`;
    const latestText = lastInbound.transcript || lastInbound.content || '';
    const startedAt = deps.now();
    const base = { supabase, workspaceId, conversation, ownerVersion, latestText, idempotencyKey, asDraft: gate.asDraft };

    const optOut = await handleOptOut(base);
    if (optOut) return optOut;

    const closingResult = await handleClosingReply({
      ...base, lastInbound, settings: ctx.settings, env: deps.env, routeFn: deps.routeFn, messages, notify: deps.notifyAdmin,
    });
    if (closingResult) return closingResult;

    const trigger = detectHandoffTrigger(latestText);
    if (trigger) {
      await supabase.rpc('ai_enqueue_ai_reply', {
        p_workspace_id: workspaceId, p_conversation_id: conversationId, p_expected_owner_version: ownerVersion,
        p_idempotency_key: idempotencyKey, p_content: handoffMessage(ctx.settings), p_as_draft: gate.asDraft,
      });
      await markNeedsHumanWithSummary({ supabase, workspaceId, conversation, messages, reason: trigger.reason, settings: ctx.settings, notify: deps.notifyAdmin });
      return { status: 'handoff', reason: trigger.reason };
    }

    const customerStatus = await resolveCustomerStatus({ supabase, workspaceId, conversation });
    const commercial = await buildCommercialContext({ supabase, workspaceId, conversation, latestText, settings: ctx.settings, customerStatus });
    const effects = {};
    const toolCtx = {
      supabase, workspaceId, conversation, effects, ownerVersion, settings: ctx.settings,
      routeFn: deps.routeFn, clientPanelBaseUrl: ctx.clientPanelBaseUrl, checkPrimaryVocal: true,
    };
    const isFirstAiReply = !messages.some((m) => m.direction === 'outbound' && m.sender_type === 'ai');
    const result = await deps.generateReply({
      system: buildSystemPrompt({
        settings: ctx.settings, companyName: ctx.companyName, conversation, isFirstAiReply, customerStatus,
        knowledge: commercial.knowledgeText, strategies: commercial.strategiesText, examples: commercial.examplesText,
      }),
      input: buildConversationInput(messages, { maxMessages: 12 }),
      tools: TOOL_DEFINITIONS,
      executeTool: (name, args) => executeTool(name, args, toolCtx),
      env: deps.env,
      fetchImpl: deps.fetchImpl,
      toolChoice: requiredToolFor(latestText, conversation.lead_data || {}) || requiredQuoteTableFor(latestText, conversation.lead_data || {}),
    });
    await recordUsage(supabase, {
      workspace_id: workspaceId, conversation_id: conversationId, kind: 'reply', model: result.model,
      input_tokens: result.inputTokens, output_tokens: result.outputTokens, cost_usd: result.costUsd,
    });

    // Resumo de fechamento é sempre o texto determinístico, nunca o do modelo.
    let text = effects.closingSummaryText
      || stripUnapprovedPaymentClaims(sanitizeReply(result.text), { paymentApproved: commercial.paymentApproved })
      || (effects.needsHuman ? handoffMessage(ctx.settings) : null);
    // Apresentação única garantida no 1º contato (o resumo de fechamento não é alterado).
    if (text && isFirstAiReply && !effects.closingSummaryText) text = ensureFirstContactIntro(text, { settings: ctx.settings, companyName: ctx.companyName });
    if (!text) {
      await markNeedsHuman(supabase, workspaceId, conversationId, 'ai_error');
      return { status: 'handoff', reason: 'empty_reply' };
    }
    // Trava: link de pré-contrato só sai pelo fluxo aprovado (closing-link), nunca em resposta da IA.
    if (/\/contrato\/[A-Za-z0-9_-]+/.test(text)) {
      await markNeedsHumanWithSummary({ supabase, workspaceId, conversation, messages, reason: 'link_without_approval', settings: ctx.settings, notify: deps.notifyAdmin });
      return { status: 'handoff', reason: 'link_without_approval' };
    }
    const { data: enqueued } = await supabase.rpc('ai_enqueue_ai_reply', {
      p_workspace_id: workspaceId, p_conversation_id: conversationId, p_expected_owner_version: ownerVersion,
      p_idempotency_key: idempotencyKey, p_content: text, p_as_draft: gate.asDraft,
    });
    const row = first(enqueued);
    let crm = null;
    if (row?.outbox_id) {
      crm = await applyCommercialEffects({ supabase, workspaceId, conversation, latestText, effects, toolCalls: result.toolCalls || [], settings: ctx.settings });
    }
    if (effects.needsHuman) {
      await markNeedsHumanWithSummary({ supabase, workspaceId, conversation, messages, reason: effects.needsHuman.reason, settings: ctx.settings, notify: deps.notifyAdmin });
    }
    traceAiReply({
      env: deps.env, fetchImpl: deps.fetchImpl, startMs: startedAt, endMs: deps.now(),
      attributes: replyTraceAttributes({ result, conversation, commercial, workspaceId, outcome: row?.status }),
      content: { input: latestText, output: text },
    }).catch(() => {});
    return {
      status: row?.status || 'rejected', outboxId: row?.outbox_id || null, tools: result.toolCalls,
      strategies: commercial.strategyKeys, stage: crm?.stage || conversation.sales_stage, followups: crm?.followups || 0,
    };
  } catch (error) {
    console.error('[AI][REPLY][ERROR]', { message: error?.message });
    await markNeedsHuman(supabase, workspaceId, conversationId, 'ai_error');
    return { status: 'error', reason: error?.message || 'unknown' };
  } finally {
    await supabase.rpc('ai_release_conversation_reply', { p_workspace_id: workspaceId, p_conversation_id: conversationId });
  }
}

// ---------------------------------------------------------------------------
// Despacho
// ---------------------------------------------------------------------------

/**
 * Destinatário de saída. Exceção restrita ao número de TESTE da Meta (+1 555…): a lista "To" da Meta
 * guarda celulares brasileiros com o 9º dígito, mas o webhook entrega o wa_id antigo (55+DDD+8 dígitos).
 * Só nesse canal de teste o envio usa o formato autorizado; a conversa continua identificada pelo wa_id.
 * Canais reais não mudam.
 */
export function outboundRecipient(chatId, channel = {}) {
  const id = String(chatId || '');
  const isMetaTestNumber = /^1555\d{7}$/.test(String(channel?.display_phone || '').replace(/\D/g, ''));
  if (isMetaTestNumber && /^55\d{2}[6-9]\d{7}$/.test(id)) return `${id.slice(0, 4)}9${id.slice(4)}`;
  return id;
}
export async function dispatchOutbox({ supabase, workspaceId = null, limit = 10, deps: overrides } = {}) {
  const deps = defaultDeps(overrides);
  const { data: claimed, error } = await supabase.rpc('ai_claim_outbox', {
    p_limit: limit, p_lease_seconds: 60, p_workspace_id: workspaceId,
  });
  if (error) throw error;
  const results = [];
  const contexts = new Map();
  for (const item of claimed || []) {
    let outcome;
    try {
      if (!contexts.has(item.workspace_id)) contexts.set(item.workspace_id, await loadWorkspaceAiContext(supabase, item.workspace_id));
      const ctx = contexts.get(item.workspace_id);
      // Kill switch global também barra envios já reservados da IA.
      if (item.sender_type === 'ai' && !resolveAiGate({ env: deps.env, settings: ctx.settings, channel: ctx.channel }).allowed) {
        outcome = { status: 'failed', error: 'ai_gate_closed' };
      } else {
        const { data: conversation } = await supabase.from('ai_conversations').select('provider_chat_id, last_inbound_at')
          .eq('id', item.conversation_id).eq('workspace_id', item.workspace_id).maybeSingle();
        if (item.message_kind === 'template') {
          // Template aprovado pela Meta: único formato permitido fora da janela de 24h.
          const token = await getChannelToken(ctx.channel, deps.env);
          outcome = await deps.sendTemplateMessage({
            phoneNumberId: ctx.channel.phone_number_id, token, to: outboundRecipient(conversation.provider_chat_id, ctx.channel),
            name: item.template_name, language: item.template_language || 'pt_BR', params: item.template_params || [], fetchImpl: deps.fetchImpl,
          });
        } else if (!isWithinCustomerServiceWindow(conversation?.last_inbound_at, deps.now())) {
          outcome = { status: 'failed', error: 'outside_24h_window' };
        } else {
          const token = await getChannelToken(ctx.channel, deps.env);
          outcome = await deps.sendTextMessage({
            phoneNumberId: ctx.channel.phone_number_id, token, to: outboundRecipient(conversation.provider_chat_id, ctx.channel), text: item.content, fetchImpl: deps.fetchImpl,
          });
        }
      }
    } catch (err) {
      outcome = { status: 'failed', error: String(err?.message || 'dispatch_error').slice(0, 80) };
    }
    await supabase.rpc('ai_complete_outbox', {
      p_outbox_id: item.id, p_status: outcome.status, p_provider_message_id: outcome.providerMessageId || null, p_error: outcome.error || null,
    });
    results.push({ id: item.id, status: outcome.status, error: outcome.error || null });
    if (outcome.status === 'sent' && String(item.idempotency_key || '').startsWith('closing-link:')) {
      try { await markLinkSent({ supabase, workspaceId: item.workspace_id, outboxId: item.id, settings: contexts.get(item.workspace_id)?.settings }); } catch { /* reconciliado no painel */ }
    } else if (outcome.status === 'sent' && item.sender_type === 'human') {
      try { await observeHumanReply({ supabase, workspaceId: item.workspace_id, conversationId: item.conversation_id }); } catch { /* não bloqueia */ }
    }
  }
  return results;
}

/** Ciclo do cron: reconcilia leases vencidos, responde conversas pendentes e despacha. */
export async function runInboxCycle({ supabase, debounceMs = 4000, maxConversations = 10, deps: overrides } = {}) {
  const deps = defaultDeps(overrides);
  const { data: reaped } = await supabase.rpc('ai_reap_stale_dispatching');
  const cutoff = new Date(deps.now() - debounceMs).toISOString();
  const { data: pending } = await supabase.from('ai_conversations').select('id, workspace_id')
    .not('ai_pending_since', 'is', null).lte('ai_pending_since', cutoff).eq('owner', 'ai')
    .order('ai_pending_since', { ascending: true }).limit(maxConversations);
  const replies = [];
  for (const row of pending || []) {
    replies.push(await processConversationReply({ supabase, workspaceId: row.workspace_id, conversationId: row.id, deps }));
  }
  // Follow-ups vencidos viram itens de outbox (template) na mesma transação; o claim revalida.
  const { data: followups } = await supabase.rpc('ai_claim_due_followups', { p_limit: 20 });
  const dispatched = await dispatchOutbox({ supabase, deps });
  return { reaped: Number(reaped || 0), replies, followups: (followups || []).length, dispatched };
}
