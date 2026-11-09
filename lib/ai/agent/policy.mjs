/**
 * Regras de decisão da IA (puras). Ordem de precedência, todas fail-closed:
 *  1. Kill switch global (env AI_INBOX_KILL_SWITCH=true) ou IA global não habilitada
 *     (AI_INBOX_AI_ENABLED!=true) => nenhuma geração nem envio pela IA.
 *  2. Workspace: ai_enabled=false ou mode='observe' => só ingestão/registro.
 *  3. Canal precisa estar 'active'.
 *  4. Conversa: owner='ai', aberta, sem pedido de humano pendente.
 *  5. Orçamento diário/mensal e limite de turnos.
 */
export const AI_MODES = Object.freeze({ OBSERVE: 'observe', DRAFT: 'draft', AUTO: 'auto' });

export function readGlobalAiFlags(env = process.env) {
  return {
    killSwitch: String(env.AI_INBOX_KILL_SWITCH || '').toLowerCase() === 'true',
    aiEnabled: String(env.AI_INBOX_AI_ENABLED || '').toLowerCase() === 'true',
  };
}

export function resolveAiGate({ env = process.env, settings, channel, conversation, usage } = {}) {
  const flags = readGlobalAiFlags(env);
  if (flags.killSwitch) return { allowed: false, reason: 'global_kill_switch' };
  if (!flags.aiEnabled) return { allowed: false, reason: 'global_ai_disabled' };
  if (!settings || settings.ai_enabled !== true) return { allowed: false, reason: 'workspace_ai_disabled' };
  const mode = settings.mode;
  if (mode !== AI_MODES.DRAFT && mode !== AI_MODES.AUTO) return { allowed: false, reason: 'observe_mode' };
  if (!channel || channel.status !== 'active') return { allowed: false, reason: 'channel_inactive' };
  if (conversation) {
    if (conversation.owner !== 'ai') return { allowed: false, reason: 'human_owner' };
    if (conversation.ai_enabled !== true) return { allowed: false, reason: 'conversation_ai_disabled' };
    if (conversation.state !== 'open') return { allowed: false, reason: 'conversation_closed' };
    if (conversation.needs_human) return { allowed: false, reason: 'awaiting_human' };
    const maxTurns = Number(settings.max_ai_turns_per_conversation || 0);
    if (maxTurns > 0 && Number(conversation.ai_turns || 0) >= maxTurns) return { allowed: false, reason: 'turn_limit', handoff: true };
  }
  if (usage) {
    if (Number(usage.day_replies || 0) >= Number(settings.daily_ai_reply_limit ?? 0)) return { allowed: false, reason: 'daily_reply_limit', handoff: true };
    if (Number(usage.day_cost || 0) >= Number(settings.daily_cost_limit_usd ?? 0)) return { allowed: false, reason: 'daily_cost_limit', handoff: true };
    if (Number(usage.month_cost || 0) >= Number(settings.monthly_cost_limit_usd ?? 0)) return { allowed: false, reason: 'monthly_cost_limit', handoff: true };
  }
  return { allowed: true, mode, asDraft: mode === AI_MODES.DRAFT };
}

function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const HUMAN_REQUEST = [
  /\b(falar|conversar|atendimento)\s+com\s+(um|uma|o|a|alguem|algum|voces|pessoa|humano|atendente|responsavel|dono|dona|gerente|equipe)/,
  /\b(atendente|humano|pessoa de verdade|pessoa real)\b/,
  /\b(voce e|e um|e uma|isso e)\s+(robo|bot|ia|inteligencia artificial)\b/,
  /\bme\s+(liga|ligue|ligar)\b/,
];
const SENSITIVE = [
  { re: /\b(reclama|insatisfeit|pessimo|absurdo|decepcion|procon|advogad|processo judicial|justica)\w*/, reason: 'complaint_or_legal' },
  { re: /\b(cancelar|cancelamento|reembolso|estorno|devolu)\w*/, reason: 'cancellation_or_refund' },
  // Pedido de desconto NÃO transfere de imediato (Manual §10): a IA segue a ordem de negociação e só
  // na última tentativa pede exceção via solicitar_aprovacao.
  { re: /\b(alterar|mudar|trocar|aditivo|renegociar)\b.{0,30}\b(contrato|clausula|data do evento|valor)\b/, reason: 'contract_change' },
  // Dúvidas de pagamento são respondidas com o conhecimento aprovado; só divergência vai para humano.
  { re: /\b(ja paguei|paguei e|cobranca (indevida|errada|duplicada)|pagamento (nao|não) (caiu|aparece|consta)|comprovante (nao|não) (foi|aparece))/, reason: 'payment_topic' },
];

/** Detecta pedido explícito de humano ou assunto que exige pessoa (sem chamar a IA). */
export function detectHandoffTrigger(text) {
  const t = normalizeText(text);
  if (!t.trim()) return null;
  if (HUMAN_REQUEST.some((re) => re.test(t))) return { reason: 'customer_requested_human' };
  for (const { re, reason } of SENSITIVE) if (re.test(t)) return { reason };
  return null;
}

/** Limpa a saída do modelo: curta, sem markdown pesado, sem placeholders. */
export function sanitizeReply(text, { maxChars = 700 } = {}) {
  let out = String(text || '').replace(/\r/g, '').replace(/\*\*(.+?)\*\*/g, '*$1*').replace(/^#+\s*/gm, '').trim();
  if (/\[(nome|valor|data|preço|preco)[^\]]*\]|\{\{.+?\}\}/i.test(out)) return null; // placeholder => não envia
  if (out.length > maxChars) {
    const cut = out.slice(0, maxChars);
    const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '), cut.lastIndexOf('\n'));
    out = (lastStop > maxChars * 0.5 ? cut.slice(0, lastStop + 1) : cut).trim();
  }
  return out || null;
}

// "entrada" sozinha é comum em casamento (entrada da noiva): só conta como pagamento em expressões claras.
const PAYMENT_CLAIM = /\b(pix|cart[aã]o|boleto|parcel\w*|sinal de|saldo)\b|\b(sem|dar|de|com) entrada\b|\bentrada (de|ap[oó]s|no|na)\s+(\d|r\$|ato|assinatura|contrat)|\d{1,3}\s*%/i;
export const PAYMENT_DEFERRAL = 'As condições de pagamento a equipe envia junto com a proposta 😊';
/**
 * Sem regra de pagamento aprovada, remove frases que citam condições (percentuais, Pix, cartão,
 * parcelas, entrada...) e informa que a equipe envia as condições. Com regra aprovada, não altera.
 */
export function stripUnapprovedPaymentClaims(text, { paymentApproved = false } = {}) {
  if (paymentApproved || !text || !PAYMENT_CLAIM.test(text)) return text;
  const parts = String(text).split(/(?<=[.!?…])\s+|\n+/);
  const kept = parts.filter((p) => !PAYMENT_CLAIM.test(p));
  const out = kept.join(' ').trim();
  return out ? `${out} ${PAYMENT_DEFERRAL}` : PAYMENT_DEFERRAL;
}

export const HANDOFF_CUSTOMER_MESSAGE =
  'Combinado! Vou chamar alguém da nossa equipe para continuar com você por aqui 😊';

/** Mensagem de transferência (Manual §19): sem prometer prazo; cita o responsável configurado, se houver. */
export function handoffMessage(settings = {}) {
  const who = String(settings?.handoff_contact_name || '').trim();
  return who
    ? `Combinado! Vou chamar o ${who} para continuar com você por aqui 😊`
    : HANDOFF_CUSTOMER_MESSAGE;
}

export const HANDOFF_REASON_LABELS = Object.freeze({
  customer_requested_human: 'Cliente pediu atendimento humano',
  complaint_or_legal: 'Reclamação ou assunto jurídico',
  cancellation_or_refund: 'Cancelamento ou reembolso',
  discount_request: 'Pedido de desconto (exige aprovação)',
  contract_change: 'Alteração contratual (exige aprovação)',
  payment_topic: 'Assunto de pagamento',
  ai_requested: 'A IA solicitou apoio humano',
  turn_limit: 'Limite de turnos da IA',
  daily_reply_limit: 'Limite diário de respostas da IA',
  daily_cost_limit: 'Limite diário de custo da IA',
  monthly_cost_limit: 'Limite mensal de custo da IA',
  ai_error: 'Falha na IA',
  business_app_reply: 'Equipe respondeu pelo app WhatsApp Business',
  human_reply_in_inbox: 'Equipe respondeu pelo Inbox',
  manual: 'Assumido manualmente',
  territory_blocked: 'Local não atendido/condicional (verificar logística)',
  pricing_exception: 'Orçamento com exceção (aprovação)',
  availability_review: 'Agenda de músicos inconclusiva ou em conflito',
  closing_review: 'Fechamento aguardando a equipe',
  draft_approved: 'Rascunho aprovado pela equipe',
  link_without_approval: 'IA tentou enviar link de contrato sem aprovação (bloqueado)',
});

const FORMATION_WORD = /\b(solo|duo|dupla|trio|quarteto|quinteto|sexteto|septeto)\b/;
const DATE_HINT = /\b\d{1,2}\s*\/\s*\d{1,2}(\s*\/\s*\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/;

/**
 * Ferramenta obrigatória da rodada (determinístico, sem chamar o modelo):
 *  - decisão de fechar com formação e data => preparar_fechamento;
 *  - pedido de orçamento com formação e data => calcular_orcamento.
 * Sem formação+data (no texto ou nos dados já registrados), nada é forçado.
 */
export function requiredToolFor(text, lead = {}) {
  const t = normalizeText(text);
  const hasFormation = FORMATION_WORD.test(t) || Boolean(lead.formacao);
  const hasDate = DATE_HINT.test(t) || Boolean(lead.data_evento);
  if (!hasFormation || !hasDate) return null;
  // "CONFIRMO" sem resumo pendente (o resumo pendente é tratado antes, pelo motor de fechamento).
  if (/^(ok |sim )?(confirmo|confirmado|confirmada)( pode gerar)?$/.test(t.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim())) return 'preparar_fechamento';
  if (/\b(queremos|quero|vamos|podemos|decidimos|bora|pode)\b.{0,30}\b(fechar|contratar|reservar)\b|\bdecidimos\b/.test(t)) return 'preparar_fechamento';
  if (/\b(quanto|valor|valores|preco|precos|orcamento|custa|fica)\b/.test(t)) return 'calcular_orcamento';
  return null;
}

/** Orçamento primeiro: pedido de valores com data, mas sem formação => tabela vigente (consultar_precos). */
export function requiredQuoteTableFor(text, lead = {}) {
  const t = normalizeText(text);
  const hasFormation = FORMATION_WORD.test(t) || Boolean(lead.formacao);
  const hasDate = DATE_HINT.test(t) || Boolean(lead.data_evento);
  if (hasFormation || !hasDate) return null;
  return /\b(quanto|valor|valores|preco|precos|orcamento|custa|fica|tabela)\b/.test(t) ? 'consultar_precos' : null;
}

/** Pedido de descadastro de mensagens (consentimento): encerra remarketing. */
export function detectOptOut(text) {
  const t = String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return /^(pare|parar|sair|stop|cancelar)[\s!.]*$/.test(t)
    || /\b(nao (quero|desejo) (mais )?receber|para de (me )?mandar|pare de (me )?mandar|me (tira|tire|remova|remove) (da lista|dessas mensagens)|nao tenho (mais )?interesse|sem interesse|descadastr)/.test(t);
}

export const OPT_OUT_CONFIRMATION = 'Tudo bem! Não vou mais enviar mensagens de acompanhamento. Se precisar de algo, é só chamar por aqui 🙂';

/** Resumo determinístico para a transferência humana (contexto para quem assume). */
export function buildHandoffSummary({ conversation = {}, messages = [], reason = '' }) {
  const lead = Object.entries(conversation.lead_data || {}).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join('; ');
  const lastCustomer = messages.filter((m) => m.direction === 'inbound').slice(0, 3).reverse()
    .map((m) => `“${String(m.transcript || m.content || '').replace(/\s+/g, ' ').slice(0, 140)}”`).join(' ');
  return [
    `Motivo: ${HANDOFF_REASON_LABELS[reason] || reason || 'não informado'}`,
    `Etapa: ${conversation.sales_stage || 'new'}`,
    conversation.objections?.length ? `Objeções: ${conversation.objections.join(', ')}` : null,
    lead ? `Dados: ${lead}` : null,
    lastCustomer ? `Últimas mensagens do cliente: ${lastCustomer}` : null,
  ].filter(Boolean).join('\n').slice(0, 1200);
}
