/**
 * Motor comercial: etapas determinísticas que envolvem a geração do LLM.
 *  - antes: opt-out e resposta ao resumo de fechamento (confirmação expressa);
 *  - contexto: conhecimento aprovado seletivo + 1–2 estratégias + exemplos aprovados;
 *  - depois: etapa do CRM, objeções, follow-ups, transferência humana com resumo.
 */
import { detectOptOut, OPT_OUT_CONFIRMATION, buildHandoffSummary } from '../agent/policy.mjs';
import { selectKnowledge, formatKnowledgeForPrompt, detectIntents } from './knowledge.mjs';
import { rememberSignals } from './memory.mjs';
import { selectStrategies, formatStrategiesForPrompt, detectObjections } from './strategies.mjs';
import { classifyConfirmation, hashSummary } from './closing.mjs';
import { quoteForWorkspace } from './pricing.mjs';
import { matchesScope } from './bootstrap.mjs';
import { prepareClosingForApproval, approveAndQueueLink, PREPARING_MESSAGE } from './supervision.mjs';
import { checkPrimaryVocal, checkMusician } from './schedule.mjs';

const first = (data) => (Array.isArray(data) ? data[0] : data) || null;
const CACHE_TTL_MS = 60_000;
const knowledgeCache = new Map();

export function clearKnowledgeCache() { knowledgeCache.clear(); }

async function loadActiveKnowledge(supabase, workspaceId, now = Date.now()) {
  const hit = knowledgeCache.get(workspaceId);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.items;
  const { data } = await supabase.from('ai_knowledge_items')
    .select('id, item_key, kind, title, content, intents, keywords, metadata, priority, status')
    .eq('workspace_id', workspaceId).eq('status', 'active');
  const items = data || [];
  knowledgeCache.set(workspaceId, { at: now, items });
  return items;
}

async function enqueueAi({ supabase, workspaceId, conversationId, ownerVersion, key, content, asDraft }) {
  const { data } = await supabase.rpc('ai_enqueue_ai_reply', {
    p_workspace_id: workspaceId, p_conversation_id: conversationId, p_expected_owner_version: ownerVersion,
    p_idempotency_key: key, p_content: content, p_as_draft: asDraft,
  });
  return first(data);
}

export async function setStage({ supabase, workspaceId, conversationId, stage, reason = null }) {
  const { error } = await supabase.rpc('ai_set_sales_stage', { p_workspace_id: workspaceId, p_conversation_id: conversationId, p_stage: stage, p_reason: reason });
  return !error;
}

export async function markNeedsHumanWithSummary({ supabase, workspaceId, conversation, messages = [], reason, settings, notify }) {
  const summary = buildHandoffSummary({ conversation, messages, reason });
  const { error } = await supabase.from('ai_conversations')
    .update({ needs_human: true, needs_human_reason: reason, handoff_summary: summary, updated_at: new Date().toISOString() })
    .eq('id', conversation.id).eq('workspace_id', workspaceId);
  if (error) throw new Error('handoff_not_recorded');
  // Notificação externa ao responsável configurado, somente se habilitada no workspace.
  if (settings?.notify_admin_on_handoff && notify) {
    const who = settings.handoff_contact_name ? `${settings.handoff_contact_name}, ` : '';
    try { await notify(`${who}uma conversa do Inbox precisa de você.\n${summary}`, { workspaceId }); } catch { /* não bloqueia */ }
  }
  return summary;
}

/** Opt-out: registra, cancela remarketing e confirma uma única vez. */
export async function handleOptOut({ supabase, workspaceId, conversation, ownerVersion, latestText, idempotencyKey, asDraft }) {
  if (!detectOptOut(latestText)) return null;
  await supabase.rpc('ai_opt_out', { p_workspace_id: workspaceId, p_conversation_id: conversation.id });
  const row = await enqueueAi({ supabase, workspaceId, conversationId: conversation.id, ownerVersion, key: idempotencyKey, content: OPT_OUT_CONFIRMATION, asDraft });
  return { status: row?.status || 'rejected', reason: 'opted_out', outboxId: row?.outbox_id || null };
}

/** Recalcula preço/agenda do resumo confirmado. Retorna { ok, reason }. */
async function revalidateClosing({ supabase, workspaceId, closing, settings, routeFn }) {
  const s = closing.summary;
  const quote = await quoteForWorkspace({
    supabase, workspaceId, settings, routeFn,
    input: {
      date: s.date, formation: s.ceremony.formation, instruments: (s.ceremony.instruments || []).join(', '),
      hasSound: s.sound, location: s.location,
      reception: s.reception ? { formation: s.reception.formation, hours: s.reception.hours, instruments: (s.reception.instruments || []).join(', ') } : { hours: 0 },
    },
  });
  if (!quote.ok || !quote.final) return { ok: false, reason: 'quote_no_longer_final' };
  if (Math.abs(Number(quote.total) - Number(s.total)) > 0.009) return { ok: false, reason: 'price_changed' };
  const vocal = (s.musicians || []).find((m) => /voz/i.test(m.role || ''));
  if (vocal) {
    const request = { date: s.date, time: s.time, durationMin: 60, bufferMin: settings?.schedule_buffer_minutes };
    const primary = await checkPrimaryVocal({ supabase, workspaceId, request });
    let status = primary.primary?.name === vocal.name ? primary.status : null;
    if (status === null) {
      const { data: profiles } = await supabase.from('ai_musician_profiles').select('*').eq('workspace_id', workspaceId).eq('active', true);
      const p = (profiles || []).find((x) => x.display_name === vocal.name);
      status = p ? (await checkMusician({ supabase, workspaceId, profile: p, request })).status : 'review';
    }
    if (status !== 'available') return { ok: false, reason: 'availability_changed' };
  }
  return { ok: true };
}

/**
 * Resposta do cliente com resumo aguardando confirmação.
 * Confirmação expressa => revalida e gera pré-contrato. Qualquer outra resposta invalida o
 * resumo e devolve o controle ao LLM (que pode preparar um novo resumo).
 */
export async function handleClosingReply({ supabase, workspaceId, conversation, ownerVersion, lastInbound, latestText, settings, asDraft, env, routeFn, messages, notify }) {
  const { data: closing } = await supabase.from('ai_closings').select('*')
    .eq('workspace_id', workspaceId).eq('conversation_id', conversation.id).eq('status', 'awaiting_confirmation').maybeSingle();
  if (!closing) return null;
  const now = new Date().toISOString();
  if (classifyConfirmation(latestText) !== 'confirm') {
    await supabase.from('ai_closings').update({ status: 'invalidated', error: 'not_confirmed', updated_at: now }).eq('id', closing.id);
    return null;
  }
  const key = `closing:${closing.id}`;
  const fail = async (reason, message) => {
    await supabase.from('ai_closings').update({ status: 'needs_human', error: reason, updated_at: new Date().toISOString() }).eq('id', closing.id);
    await enqueueAi({ supabase, workspaceId, conversationId: conversation.id, ownerVersion, key, content: message, asDraft });
    await markNeedsHumanWithSummary({ supabase, workspaceId, conversation, messages, reason: 'closing_review', settings, notify });
    return { status: 'handoff', reason };
  };
  const expectedHash = await hashSummary(closing.summary);
  const { data: confirmed } = await supabase.rpc('ai_confirm_closing', {
    p_workspace_id: workspaceId, p_closing_id: closing.id, p_summary_hash: expectedHash, p_message_id: lastInbound.provider_message_id || lastInbound.id,
  });
  if (!confirmed) return { status: 'skipped', reason: 'closing_not_confirmable' };

  const check = await revalidateClosing({ supabase, workspaceId, closing, settings, routeFn });
  if (!check.ok) return fail(check.reason, 'Obrigada pela confirmação! Antes de gerar o pré-contrato preciso confirmar um detalhe com a equipe. Já te retorno por aqui.');

  // Manual §14/§20: prepara o pré-contrato (rascunho) e decide pelo modo de autonomia liberado.
  const prepared = await prepareClosingForApproval({ supabase, workspaceId, conversation, closing, settings, env });
  if (!prepared.ok) return fail(prepared.reason, 'Obrigada! Vou pedir para a equipe finalizar seu pré-contrato e te enviar por aqui.');
  if (prepared.auto) {
    const sent = await approveAndQueueLink({ supabase, workspaceId, closingId: closing.id, approvalHash: prepared.approvalHash, actor: null, mode: prepared.mode });
    if (sent.ok) return { status: 'pending', reason: 'precontract_auto_approved', precontractId: prepared.precontractId, mode: prepared.mode };
  }
  const row = await enqueueAi({ supabase, workspaceId, conversationId: conversation.id, ownerVersion, key, content: PREPARING_MESSAGE, asDraft });
  if (notify && settings?.notify_admin_on_handoff) {
    try { await notify(`${settings.handoff_contact_name ? `${settings.handoff_contact_name}, ` : ''}há um pré-contrato aguardando sua aprovação no painel.`, { workspaceId }); } catch { /* não bloqueia */ }
  }
  return { status: row?.status || 'pending', reason: 'awaiting_approval', precontractId: prepared.precontractId, exceptions: prepared.reasons, mode: prepared.mode };
}

/** Cliente contratado = conversa com pré-contrato assinado. */
export async function resolveCustomerStatus({ supabase, workspaceId, conversation }) {
  if (!conversation?.precontract_id) return 'lead';
  const { data: contract } = await supabase.from('contracts').select('status, signed_at')
    .eq('precontract_id', conversation.precontract_id).eq('workspace_id', workspaceId).maybeSingle();
  return contract?.status === 'signed' || contract?.signed_at ? 'client' : 'lead';
}

const PAYMENT_TEXT = /\b(pagamento|pagar|pix|boleto|cart[aã]o|parcela|sinal|entrada|saldo)\b/i;
/** Há regra/política ATIVA (aprovada pelo Owner) sobre condições de pagamento? */
export function hasApprovedPaymentRule(items = []) {
  return items.some((i) => i.status === 'active' && ['rule', 'policy', 'faq'].includes(i.kind)
    && PAYMENT_TEXT.test(`${i.title || ''} ${i.content || ''}`));
}

/** A mesma objeção voltou? (skill de objeções: na repetição, pare de rebater e re-diagnostique/escalone.) */
export function repeatedObjection(conversation = {}, latestText = '') {
  const now = detectObjections(latestText);
  return now.find((o) => (conversation.objections || []).includes(o)) || null;
}

/** Contexto seletivo para o prompt (sem histórico completo). */
export async function buildCommercialContext({ supabase, workspaceId, conversation, latestText, settings, customerStatus }) {
  // Conhecimento com escopo (ex.: cláusulas de um modelo de aniversário) só vale para o tipo de evento dele.
  // Memória contextual da cliente: guarda sinais da mensagem atual antes de gerar (retrieve → generate → store).
  await rememberSignals({ supabase, workspaceId, conversation, latestText }).catch(() => null);
  // Decisões da equipe nesta conversa (exceções efetivamente aprovadas/recusadas): base para retomadas.
  if (conversation?.id) {
    const { data: decided } = await supabase.from('ai_approvals').select('kind, summary, status, decided_at')
      .eq('workspace_id', workspaceId).eq('conversation_id', conversation.id).in('status', ['approved', 'rejected'])
      .order('decided_at', { ascending: false }).limit(5);
    conversation.team_decisions = decided || [];
  }
  const eventType = conversation?.lead_data?.tipo_evento || '';
  const items = (await loadActiveKnowledge(supabase, workspaceId)).filter((i) => matchesScope(i, eventType));
  const stage = customerStatus === 'client' && !['won', 'post_sale'].includes(conversation.sales_stage) ? 'post_sale' : conversation.sales_stage;
  const strategyKeys = selectStrategies({ stage, text: latestText, enabled: settings?.strategies_enabled, max: 2 });
  // Condições de pagamento só existem se houver regra ATIVA (aprovada) sobre pagamento.
  const paymentApproved = hasApprovedPaymentRule(items);
  const intents = detectIntents(latestText);
  if (paymentApproved && strategyKeys.includes('price_objection') && !intents.includes('payment')) intents.push('payment');
  const kinds = customerStatus === 'client' ? null : ['rule', 'faq', 'policy', 'rider', 'response'];
  const knowledge = selectKnowledge(items, { text: latestText, intents, limit: 4, charBudget: 1600, kinds });
  const examples = selectKnowledge(items, { text: latestText, intents, limit: 2, charBudget: 700, kinds: ['example', 'style'] });
  // Link de montagem só se constar em conhecimento ATIVO (aprovado) — nunca fixo no código.
  const formUrl = (items.filter((i) => i.status === 'active').map((i) => /https?:\/\/\S*monte-sua-banda\S*/i.exec(String(i.content || ''))?.[0]).find(Boolean) || null)?.replace(/[).,;]+$/, '') || null;
  return {
    formUrl,
    knowledgeText: formatKnowledgeForPrompt(knowledge),
    examplesText: formatKnowledgeForPrompt(examples),
    strategiesText: formatStrategiesForPrompt(strategyKeys, { paymentApproved, repeatedObjection: repeatedObjection(conversation, latestText), discountAsk: detectObjections(latestText).includes('discount') }),
    strategyKeys,
    paymentApproved,
    knowledgeIds: [...knowledge, ...examples].map((k) => k.id),
    intents,
  };
}

/**
 * Cadência do Manual §12: conversar com parceiro(a) => 2 dias; comparando/indeciso => 3 dias;
 * última tentativa 5 dias depois. Máximo padrão de 2 abordagens proativas.
 */
export function followupCadence({ text = '', max = 2 }) {
  const partner = /\b(noiv[oa]|marido|esposa|namorad[oa]|parceir[oa]|m[aã]e|pai|fam[ií]lia)\b/i.test(text) && /\b(falar|conversar|ver com|decidir)\b/i.test(text);
  const first = partner ? 2 : 3;
  const days = [first, first + 5];
  return days.slice(0, Math.max(0, Math.min(Number(max) || 0, 2)));
}

/** Efeitos pós-resposta: objeções, etapa, follow-ups. */
export async function applyCommercialEffects({ supabase, workspaceId, conversation, latestText, effects, toolCalls = [], settings }) {
  const objections = detectObjections(latestText);
  if (objections.length) {
    const merged = [...new Set([...(conversation.objections || []), ...objections])];
    await supabase.from('ai_conversations').update({ objections: merged }).eq('id', conversation.id).eq('workspace_id', workspaceId);
    conversation.objections = merged;
  }
  let stage = effects.stage || null;
  if (!stage) {
    if (toolCalls.includes('calcular_orcamento') && ['new', 'qualifying'].includes(conversation.sales_stage)) stage = 'proposal';
    else if (objections.length && ['proposal'].includes(conversation.sales_stage)) stage = 'negotiation';
    else if (conversation.sales_stage === 'new') stage = 'qualifying';
  }
  if (stage && stage !== conversation.sales_stage) {
    await setStage({ supabase, workspaceId, conversationId: conversation.id, stage, reason: effects.stageReason || null });
    conversation.sales_stage = stage;
  }
  let followups = 0;
  if (settings?.followup_enabled && ['qualifying', 'proposal', 'negotiation', 'closing'].includes(conversation.sales_stage) && !conversation.opted_out) {
    const days = followupCadence({ text: latestText, max: settings.followup_max ?? 2 });
    const { data } = await supabase.rpc('ai_schedule_followups', {
      p_workspace_id: workspaceId, p_conversation_id: conversation.id,
      p_days: days, p_templates: (settings.followup_templates || []).slice(0, days.length),
    });
    followups = Number(data || 0);
  }
  return { stage: conversation.sales_stage, objections, followups };
}

