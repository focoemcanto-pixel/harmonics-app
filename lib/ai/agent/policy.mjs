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
  { re: /\b(desconto|abatimento|mais barato|baixar o (valor|preco)|negociar)\b/, reason: 'discount_request' },
  { re: /\b(alterar|mudar|trocar|aditivo|renegociar)\b.{0,30}\b(contrato|clausula|data do evento|valor)\b/, reason: 'contract_change' },
  { re: /\b(paguei|comprovante|pix|boleto|parcela|pagamento)\b/, reason: 'payment_topic' },
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

export const HANDOFF_CUSTOMER_MESSAGE =
  'Combinado! Vou chamar alguém da nossa equipe para continuar com você por aqui. Em instantes te respondem 😊';

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
});
