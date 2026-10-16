// Identidade de um disparo de automação (todas exceto convite de escala, que tem
// idempotência própria em invites — ver invite-dispatch.js).
//
// Regra estrutural:
// - automation_logs.event_id = somente events.id real;
// - pré-contrato/contrato vão para precontract_id/contract_id;
// - a chave de idempotência usa a entidade correta + regra + etapa (+ destinatário nos
//   lembretes agendados, como antes), nunca "todo entityId é um event_id".

export const EVENT_ENTITY_EVENT_TYPES = new Set([
  'repertoire_pending_15_days_client',
  'payment_pending_2_days_client',
  'post_event_review_request_client',
  'schedule_pending_15_days_admin',
  'event_day_confirmation_client',
  'repertoire_review_released_client',
]);

// entityId é precontracts.id (contract_signed_client também aceita contracts.id).
export const PRECONTRACT_ENTITY_EVENT_TYPES = new Set([
  'contract_signed_client',
  'contract_signed_admin',
  'contract_review_released_client',
]);

// Lembretes agendados mantêm o destinatário na chave (semântica anterior do
// checkAutomationDuplicate: evento + regra + destinatário).
const RECIPIENT_SCOPED_EVENT_TYPES = new Set([
  'repertoire_pending_15_days_client',
  'payment_pending_2_days_client',
  'post_event_review_request_client',
  'schedule_pending_15_days_admin',
  'event_day_confirmation_client',
]);

const DEFAULT_STAGE = 'once';

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function clean(value) {
  return String(value || '').trim() || null;
}

export function resolveDispatchEntityType(eventType) {
  if (EVENT_ENTITY_EVENT_TYPES.has(eventType)) return 'event';
  if (PRECONTRACT_ENTITY_EVENT_TYPES.has(eventType)) return 'precontract';
  return 'unknown';
}

/** Etapa explícita do disparo (ex.: "adjustment:<id>", "unsigned_alert_15d"). */
export function normalizeStageKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const safe = raw.replace(/[^a-zA-Z0-9:_.\-]/g, '').slice(0, 160);
  return safe || null;
}

async function eventExists(supabase, eventId) {
  if (!isUuid(eventId)) return null;
  const { data } = await supabase.from('events').select('id, workspace_id').eq('id', eventId).maybeSingle();
  return data || null;
}

/**
 * Carrega as referências reais da entidade do disparo.
 * Retorna { entityType, found, eventId, precontractId, contractId, workspaceId }.
 * eventId só é preenchido se o evento existe (nunca viola a FK de automation_logs).
 */
export async function loadDispatchRefs({ supabase, eventType, entityId }) {
  const entityType = resolveDispatchEntityType(eventType);
  const empty = { entityType, found: false, eventId: null, precontractId: null, contractId: null, workspaceId: null };
  const id = clean(entityId);
  if (!id || !isUuid(id)) return empty;

  if (entityType === 'event') {
    const event = await eventExists(supabase, id);
    if (!event) return empty;
    return { ...empty, found: true, eventId: event.id, workspaceId: clean(event.workspace_id) };
  }

  if (entityType === 'precontract') {
    let precontract = null;
    let contract = null;

    const { data: pre } = await supabase
      .from('precontracts')
      .select('id, event_id, workspace_id')
      .eq('id', id)
      .maybeSingle();
    precontract = pre || null;

    if (!precontract) {
      const { data: byId } = await supabase
        .from('contracts')
        .select('id, precontract_id, event_id, workspace_id')
        .eq('id', id)
        .maybeSingle();
      contract = byId || null;
      if (contract?.precontract_id) {
        const { data: parent } = await supabase
          .from('precontracts')
          .select('id, event_id, workspace_id')
          .eq('id', contract.precontract_id)
          .maybeSingle();
        precontract = parent || null;
      }
    }

    if (!precontract && !contract) return empty;

    if (!contract && precontract) {
      const { data: rows } = await supabase
        .from('contracts')
        .select('id, precontract_id, event_id, workspace_id')
        .eq('precontract_id', precontract.id)
        .order('created_at', { ascending: false })
        .limit(1);
      contract = Array.isArray(rows) ? rows[0] || null : rows || null;
    }

    const event = await eventExists(supabase, clean(precontract?.event_id) || clean(contract?.event_id));
    return {
      ...empty,
      found: true,
      precontractId: clean(precontract?.id),
      contractId: clean(contract?.id),
      eventId: event?.id || null,
      workspaceId: clean(precontract?.workspace_id) || clean(contract?.workspace_id) || clean(event?.workspace_id),
    };
  }

  return empty;
}

export function buildDedupeKey({ eventType, refs, ruleId, stageKey = null, recipient = null }) {
  const entityType = refs?.entityType || resolveDispatchEntityType(eventType);
  const primary = entityType === 'event' ? refs?.eventId : refs?.precontractId || refs?.contractId;
  if (!primary || !ruleId) return null;
  const parts = [eventType, entityType, primary, 'rule', ruleId, 'stage', normalizeStageKey(stageKey) || DEFAULT_STAGE];
  if (RECIPIENT_SCOPED_EVENT_TYPES.has(eventType)) {
    parts.push('to', String(recipient || '').replace(/\D/g, '') || 'none');
  }
  return parts.join(':');
}
