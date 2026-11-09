/**
 * Um turno da assistente em SIMULAÇÃO ISOLADA: mesmo prompt, ferramentas, seleção de conhecimento e
 * travas determinísticas da produção, mas com banco em memória (descartado ao fim) e sem envio.
 * Fechamento: o resumo é o determinístico; "CONFIRMO" leva a "aguardando aprovação" (modo supervisionado),
 * nunca a link — o fluxo com banco real é coberto pelos testes locais.
 */
import { buildSystemPrompt, buildConversationInput, ensureFirstContactIntro } from '../agent/prompt.mjs';
import { TOOL_DEFINITIONS, executeTool } from '../agent/tools.mjs';
import { generateReply as realGenerateReply } from '../agent/llm.mjs';
import {
  detectHandoffTrigger, detectOptOut, sanitizeReply, buildHandoffSummary, handoffMessage,
  OPT_OUT_CONFIRMATION, requiredToolFor, requiredQuoteTableFor, stripUnapprovedPaymentClaims,
} from '../agent/policy.mjs';
import { buildCommercialContext, clearKnowledgeCache } from '../commercial/engine.mjs';
import { classifyConfirmation } from '../commercial/closing.mjs';
import { PREPARING_MESSAGE } from '../commercial/supervision.mjs';
import { createMemoryDb, memId } from './memory-db.mjs';

export const SIM_LIMITS = Object.freeze({ messages: 30, messageChars: 600, rules: 400, knowledge: 80, areas: 80, musicians: 40, bookings: 400 });
export 
function cap(list, n) { return Array.isArray(list) ? list.slice(0, n) : []; }

/** Valida e normaliza a entrada (sem lançar): devolve { ok, error, input }. */
export function parseSimInput(body = {}) {
  const messages = cap(body.messages, SIM_LIMITS.messages + 1)
    .map((m) => ({ role: m?.role === 'assistant' ? 'assistant' : 'customer', text: String(m?.text || '').slice(0, SIM_LIMITS.messageChars) }))
    .filter((m) => m.text.trim());
  if (!messages.length || messages[messages.length - 1].role !== 'customer') return { ok: false, error: 'A última mensagem deve ser do cliente.' };
  if (messages.length > SIM_LIMITS.messages) return { ok: false, error: `Máximo de ${SIM_LIMITS.messages} mensagens por conversa.` };
  const f = body.fixtures || {};
  return {
    ok: true,
    input: {
      messages,
      state: {
        lead_data: (body.state?.lead_data && typeof body.state.lead_data === 'object') ? body.state.lead_data : {},
        sales_stage: String(body.state?.sales_stage || 'new'),
        needs_human: body.state?.needs_human === true,
        closing_pending: body.state?.closing_pending === true,
      },
      today: /^\d{4}-\d{2}-\d{2}$/.test(String(body.today || '')) ? body.today : null,
      fixtures: {
        settings: f.settings || {},
        companyName: String(f.companyName || f.settings?.assistant_company || 'Empresa'),
        rules: cap(f.rules, SIM_LIMITS.rules),
        pricing: f.pricing || null,
        areas: cap(f.areas, SIM_LIMITS.areas),
        knowledge: cap(f.knowledge, SIM_LIMITS.knowledge),
        musicians: cap(f.musicians, SIM_LIMITS.musicians),
        bookings: cap(f.bookings, SIM_LIMITS.bookings),
        eventTypes: cap(f.eventTypes, 20),
      },
    },
  };
}

export async function runSimTurn(input, { env = process.env, generateReply = realGenerateReply, fetchImpl = fetch } = {}) {
  const ws = memId();
  const { messages, state, fixtures } = input;
  const latest = messages[messages.length - 1].text;
  const settings = {
    ai_enabled: true, mode: 'auto', autonomy_mode: 'supervised', followup_enabled: false, signature_reminders_enabled: false,
    schedule_buffer_minutes: 90, strategies_enabled: ['discovery', 'empathy', 'price_objection', 'closing'],
    ...fixtures.settings, workspace_id: ws,
  };
  const conversation = { id: memId(), workspace_id: ws, owner: 'ai', ai_enabled: true, state: 'open', lead_data: { ...state.lead_data }, sales_stage: state.sales_stage, owner_version: 1, objections: [] };
  const out = (reply, extra = {}) => ({
    reply, tools: [], usage: null,
    state: { lead_data: conversation.lead_data, sales_stage: conversation.sales_stage, needs_human: state.needs_human, closing_pending: false },
    ...extra,
  });

  if (state.needs_human) return out('', { status: 'skipped', reason: 'awaiting_human' });
  if (detectOptOut(latest)) return out(OPT_OUT_CONFIRMATION, { status: 'opted_out' });
  if (state.closing_pending && classifyConfirmation(latest) === 'confirm') {
    return out(PREPARING_MESSAGE, { status: 'awaiting_approval', reason: 'awaiting_approval', state: { ...out('').state, sales_stage: 'closing' } });
  }
  const history = messages.map((m, i) => ({ id: `m${i}`, direction: m.role === 'customer' ? 'inbound' : 'outbound', sender_type: m.role === 'customer' ? 'customer' : 'ai', content: m.text, created_at: new Date(Date.UTC(2000, 0, 1, 0, i)).toISOString() }));
  const trigger = detectHandoffTrigger(latest);
  if (trigger) {
    const summary = buildHandoffSummary({ conversation, messages: [...history].reverse(), reason: trigger.reason });
    return out(handoffMessage(settings), { status: 'handoff', reason: trigger.reason, handoff: { to: settings.handoff_contact_name || null, summary }, state: { ...out('').state, needs_human: true } });
  }

  const db = createMemoryDb({
    ai_conversations: [conversation],
    quote_price_rules: fixtures.rules.map((r) => ({ ...r, workspace_id: ws })),
    pricing_settings: fixtures.pricing ? [{ ...fixtures.pricing, workspace_id: ws }] : [],
    ai_service_areas: fixtures.areas.map((a) => ({ active: true, ...a, workspace_id: ws })),
    ai_knowledge_items: fixtures.knowledge.map((k, i) => ({ id: `k${i}`, status: 'active', intents: [], keywords: [], metadata: {}, priority: 50, ...k, workspace_id: ws })),
    ai_musician_profiles: fixtures.musicians.map((m) => ({ active: true, roles: [], video_urls: [], ...m, workspace_id: ws })),
    events: fixtures.bookings.map((b) => ({ ...b, workspace_id: ws })),
    event_musicians: fixtures.bookings.flatMap((b) => (b.musicians || []).map((m) => ({ id: memId(), event_id: b.id, musician_id: m.contact_id, role: m.role, status: m.status || 'confirmed', is_active: true }))),
    event_types: fixtures.eventTypes.map((t) => ({ is_active: true, ...t, workspace_id: ws })),
  }, { rpc: { ai_open_closing: () => ({ data: memId(), error: null }) } });

  clearKnowledgeCache();
  const commercial = await buildCommercialContext({ supabase: db, workspaceId: ws, conversation, latestText: latest, settings, customerStatus: 'lead' });
  const effects = {};
  const toolLog = [];
  const toolCtx = { supabase: db, workspaceId: ws, conversation, effects, ownerVersion: 1, settings, routeFn: null, clientPanelBaseUrl: null, checkPrimaryVocal: true };
  const isFirstAiReply = !messages.some((m) => m.role === 'assistant');
  const system = buildSystemPrompt({
    settings, companyName: fixtures.companyName, conversation, isFirstAiReply, customerStatus: 'lead',
    knowledge: commercial.knowledgeText, strategies: commercial.strategiesText, examples: commercial.examplesText,
    today: input.today ? new Date(`${input.today}T12:00:00Z`) : new Date(),
  });
  const result = await generateReply({
    system,
    input: buildConversationInput([...history].reverse(), { maxMessages: 12 }),
    tools: TOOL_DEFINITIONS,
    executeTool: async (name, args) => { const r = await executeTool(name, args, toolCtx); toolLog.push({ name, args, result: r }); return r; },
    env, fetchImpl,
    toolChoice: requiredToolFor(latest, conversation.lead_data || {}) || requiredQuoteTableFor(latest, conversation.lead_data || {}),
  });
  let text = effects.closingSummaryText
    || (effects.quoteTableText && isFirstAiReply ? ensureFirstContactIntro(effects.quoteTableText, { settings, companyName: fixtures.companyName, joiner: '\n\n' }) : effects.quoteTableText)
    || stripUnapprovedPaymentClaims(sanitizeReply(result.text), { paymentApproved: commercial.paymentApproved }) || (effects.needsHuman ? handoffMessage(settings) : null);
  if (text && isFirstAiReply && !effects.closingSummaryText && !effects.quoteTableText) text = ensureFirstContactIntro(text, { settings, companyName: fixtures.companyName });
  let status = 'replied';
  let reason = null;
  if (!text) { status = 'handoff'; reason = 'empty_reply'; text = ''; }
  if (/\/contrato\/[A-Za-z0-9_-]+/.test(text)) { status = 'blocked'; reason = 'link_without_approval'; text = ''; }
  const needsHuman = Boolean(effects.needsHuman) || status !== 'replied';
  return {
    reply: text, status: effects.needsHuman ? 'handoff' : status, reason: effects.needsHuman?.reason || reason,
    tools: toolLog, usage: { model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd: result.costUsd },
    knowledge_used: commercial.knowledgeIds, strategies: commercial.strategyKeys, first_reply: isFirstAiReply,
    approvals: (db.tables.ai_approvals || []).map((a) => ({ kind: a.kind, summary: a.summary })),
    vocalist_requests: (db.tables.ai_vocalist_requests || []).map((r) => ({ contact_id: r.contact_id, reason: r.reason, status: r.status, conflicts: r.conflicts })),
    invites_created: (db.tables.invites || []).length,
    vocalist_requests: (db.tables.ai_vocalist_requests || []).map((r) => ({ contact_id: r.contact_id, reason: r.reason, status: r.status, conflicts: r.conflicts })),
    invites_created: (db.tables.invites || []).length,
    state: {
      lead_data: conversation.lead_data,
      sales_stage: effects.stage || conversation.sales_stage,
      needs_human: needsHuman && status !== 'replied' ? true : Boolean(effects.needsHuman),
      closing_pending: Boolean(effects.closingSummaryText),
    },
  };
}
