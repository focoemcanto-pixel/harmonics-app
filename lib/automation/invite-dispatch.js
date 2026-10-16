// Regras do convite de escala e do lembrete de não resposta.
//
// Regra de negócio:
// - ao escalar um músico: exatamente 1 convite imediato (invite_member);
// - se o convite continuar pendente por N dias (padrão 5) contados do envio do
//   convite inicial: exatamente 1 lembrete (schedule_no_response_member);
// - aceite, recusa ou remoção antes disso cancelam o lembrete; nunca há um segundo lembrete.

export const INVITE_EVENT_TYPE = 'invite_member';
export const INVITE_REMINDER_EVENT_TYPE = 'schedule_no_response_member';
export const INVITE_EVENT_TYPES = new Set([INVITE_EVENT_TYPE, INVITE_REMINDER_EVENT_TYPE]);

export const DEFAULT_INVITE_REMINDER_DAYS = 5;
// Tentativas após erro explícito do provider (ex.: 429). Um envio aceito nunca é repetido.
export const MAX_INVITE_REMINDER_ATTEMPTS = 3;

// Regra preferida quando houver mais de uma regra ativa para o mesmo tipo:
// só uma mensagem por convite/etapa, nunca uma por regra.
const PREFERRED_RULE_KEYS = {
  [INVITE_EVENT_TYPE]: ['convite_escala_rapido', 'invite_member_auto'],
  [INVITE_REMINDER_EVENT_TYPE]: ['lembrete_nao_resposta_rapido'],
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function isInviteEventType(eventType) {
  return INVITE_EVENT_TYPES.has(eventType);
}

/**
 * Para convites, envia por no máximo uma regra (a preferida, senão a mais antiga).
 * Para os demais tipos mantém todas as regras ativas, como antes.
 */
export function selectRulesForDispatch(eventType, rules = []) {
  if (!isInviteEventType(eventType) || rules.length <= 1) return rules;
  const preferred = PREFERRED_RULE_KEYS[eventType] || [];
  for (const key of preferred) {
    const match = rules.find((rule) => rule?.key === key);
    if (match) return [match];
  }
  const sorted = [...rules].sort((a, b) =>
    String(a?.created_at || '').localeCompare(String(b?.created_at || ''))
  );
  return [sorted[0]];
}

export function resolveReminderDays(rule) {
  const value = Number(rule?.days_after);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : DEFAULT_INVITE_REMINDER_DAYS;
}

/** Data real do convite inicial: sent_at (primeiro envio) ou, em convites antigos, whatsapp_sent_at. */
export function getInitialInviteSentAt(invite) {
  const raw = invite?.sent_at || invite?.whatsapp_sent_at || null;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function todayInSaoPaulo(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type)?.value || '00';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function isCancelledEventStatus(status) {
  return ['cancelled', 'canceled', 'cancelado', 'deleted', 'arquivado', 'archived'].includes(
    String(status || '').trim().toLowerCase()
  );
}

/**
 * Elegibilidade do lembrete. Retorna { due: boolean, reason }.
 * `invite.event` deve trazer { workspace_id, event_date, status }.
 */
export function evaluateInviteReminder(invite, { days = DEFAULT_INVITE_REMINDER_DAYS, workspaceId, now = new Date() } = {}) {
  if (!invite?.id) return { due: false, reason: 'invite_missing' };
  if (String(invite.status || '').toLowerCase() !== 'pending') return { due: false, reason: 'invite_not_pending' };
  if (invite.reminder_5d_sent_at) return { due: false, reason: 'reminder_already_sent' };
  if (invite.reminder_5d_claimed_at) return { due: false, reason: 'reminder_in_progress_or_unconfirmed' };
  if (Number(invite.reminder_5d_attempts || 0) >= MAX_INVITE_REMINDER_ATTEMPTS) {
    return { due: false, reason: 'reminder_attempts_exhausted' };
  }

  const event = invite.event || null;
  if (!event) return { due: false, reason: 'event_missing' };
  if (workspaceId && String(event.workspace_id || '') !== String(workspaceId)) {
    return { due: false, reason: 'workspace_mismatch' };
  }
  if (isCancelledEventStatus(event.status)) return { due: false, reason: 'event_cancelled' };
  if (!event.event_date || String(event.event_date) < todayInSaoPaulo(now)) {
    return { due: false, reason: 'event_past' };
  }

  const initialSentAt = getInitialInviteSentAt(invite);
  if (!initialSentAt) return { due: false, reason: 'initial_invite_not_sent' };
  if (now.getTime() - initialSentAt.getTime() < days * DAY_MS) {
    return { due: false, reason: 'too_early' };
  }

  return { due: true, reason: 'due' };
}

export function extractProviderMessageId(providerResponse) {
  const candidates = [
    providerResponse?.data?.msgId,
    providerResponse?.data?.messageId,
    providerResponse?.data?.id,
    providerResponse?.msgId,
    providerResponse?.messageId,
    providerResponse?.id,
    providerResponse?.data?.data?.msgId,
    providerResponse?.data?.data?.id,
  ];
  const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim());
  return found !== undefined ? String(found) : null;
}

export function buildInviteReminderMessage({ contactName, eventName, eventDate, eventTime, memberPanelLink }) {
  const name = contactName ? `, ${contactName}` : '';
  const when = [eventDate, eventTime ? `às ${eventTime}` : ''].filter(Boolean).join(' ');
  return (
    `Olá${name}! 🎶\n\n` +
    `Seu convite para o evento ${eventName || ''}${when ? ` (${when})` : ''} ainda está aguardando sua resposta.\n\n` +
    `Acesse seu painel para confirmar ou recusar:\n${memberPanelLink || ''}`
  );
}
