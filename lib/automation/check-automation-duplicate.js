import { getSupabaseAdmin } from '../supabase-admin';

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function normalizeRecipientNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || String(value || '').trim();
}

/**
 * Verifica se já existe envio para evitar duplicidade.
 *
 * Schema atual de automation_logs:
 * - não existe entity_id;
 * - o ID da entidade é persistido como event_id quando for UUID;
 * - também é guardado em metadata.entityId/payload_json.entityId.
 *
 * Importante: a duplicidade precisa considerar a entidade atual.
 * Se filtrar apenas por workspace + regra + destinatário, qualquer contrato assinado
 * anteriormente para o admin bloqueará todos os próximos contratos.
 *
 * @param {string} workspaceId
 * @param {string} ruleId
 * @param {string} entityId
 * @param {string} recipientNumber
 * @returns {Promise<boolean>} true se já existe envio para esta mesma entidade
 */
export async function checkAutomationDuplicate(workspaceId, ruleId, entityId, recipientNumber) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const safeWorkspaceId = String(workspaceId || '').trim();
    const safeRuleId = String(ruleId || '').trim();
    const safeEntityId = String(entityId || '').trim();
    const safeRecipientNumber = normalizeRecipientNumber(recipientNumber);

    if (!safeWorkspaceId || !safeRuleId || !safeEntityId) {
      return false;
    }

    let query = supabaseAdmin
      .from('automation_logs')
      .select('id')
      .eq('workspace_id', safeWorkspaceId)
      .eq('rule_id', safeRuleId)
      .eq('status', 'sent');

    if (safeRecipientNumber) {
      query = query.or(`recipient.eq.${safeRecipientNumber},recipient_number.eq.${safeRecipientNumber}`);
    }

    if (isUuid(safeEntityId)) {
      query = query.eq('event_id', safeEntityId);
    } else {
      query = query.eq('metadata->>entityId', safeEntityId);
    }

    const { data, error } = await query.limit(1).maybeSingle();

    if (error) {
      console.error('[checkAutomationDuplicate] Erro ao verificar duplicidade:', error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('[checkAutomationDuplicate] Exceção ao verificar duplicidade:', err);
    return false;
  }
}
