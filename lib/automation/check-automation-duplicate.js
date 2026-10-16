import { getSupabaseAdmin } from '../supabase-admin';

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function normalizeRecipientNumber(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits) return digits.slice(0, 20);

  return raw
    .replace(/[%,()]/g, '')
    .replace(/\s+/g, '')
    .slice(0, 80);
}

/**
 * Verifica no histórico de automation_logs se esta regra já enviou para esta entidade.
 * Complementa a reserva atômica (dispatch-claims) para envios anteriores a ela.
 *
 * A entidade é consultada pela coluna correta:
 * - evento:       event_id (FK real para events.id);
 * - pré-contrato: precontract_id, ou metadata.entityId nos logs antigos (antes da coluna).
 * Antes, todo entityId era comparado com event_id: para contratos isso nunca casava
 * (e o próprio log violava a FK e se perdia), então não havia deduplicação.
 *
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.ruleId
 * @param {string} params.entityType - 'event' | 'precontract'
 * @param {Object} params.refs - { eventId, precontractId, contractId }
 * @param {string} params.entityId - entityId original recebido pelo motor
 * @param {string} params.recipientNumber
 * @returns {Promise<boolean>} true se já existe envio desta regra para esta entidade
 */
export async function checkAutomationDuplicate({ workspaceId, ruleId, entityType, refs = {}, entityId, recipientNumber, supabase = null }) {
  try {
    const supabaseAdmin = supabase || getSupabaseAdmin();
    const safeWorkspaceId = String(workspaceId || '').trim();
    const safeRuleId = String(ruleId || '').trim();
    const safeRecipientNumber = normalizeRecipientNumber(recipientNumber);

    if (!isUuid(safeWorkspaceId) || !isUuid(safeRuleId)) return false;

    const baseQuery = () => {
      let query = supabaseAdmin
        .from('automation_logs')
        .select('id')
        .eq('workspace_id', safeWorkspaceId)
        .eq('rule_id', safeRuleId)
        .eq('status', 'sent')
        // Só o histórico da etapa padrão: um alerta de outra etapa (ex.: contrato ainda
        // não assinado) não pode bloquear a notificação de assinatura.
        .is('metadata->>stageKey', null);
      if (safeRecipientNumber) {
        query = query.or(`recipient.eq.${safeRecipientNumber},recipient_number.eq.${safeRecipientNumber}`);
      }
      return query;
    };

    const lookups = [];
    if (entityType === 'event' && isUuid(refs.eventId)) {
      lookups.push((q) => q.eq('event_id', refs.eventId));
    } else if (entityType === 'precontract') {
      if (isUuid(refs.precontractId)) {
        lookups.push((q) => q.eq('precontract_id', refs.precontractId));
        lookups.push((q) => q.eq('metadata->>entityId', refs.precontractId));
      }
      if (isUuid(entityId) && entityId !== refs.precontractId) {
        lookups.push((q) => q.eq('metadata->>entityId', entityId));
      }
    }

    for (const apply of lookups) {
      const { data, error } = await apply(baseQuery()).limit(1).maybeSingle();
      if (error) {
        console.error('[checkAutomationDuplicate] Erro ao verificar duplicidade:', error);
        continue;
      }
      if (data) return true;
    }
    return false;
  } catch (err) {
    console.error('[checkAutomationDuplicate] Exceção ao verificar duplicidade:', err);
    return false;
  }
}
