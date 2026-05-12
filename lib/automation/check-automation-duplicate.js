import { getSupabaseAdmin } from '../supabase-admin';

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
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

    let query = supabaseAdmin
      .from('automation_logs')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('rule_id', ruleId)
      .eq('status', 'sent');

    if (recipientNumber) {
      query = query.or(`recipient.eq.${recipientNumber},recipient_number.eq.${recipientNumber}`);
    }

    if (isUuid(entityId)) {
      query = query.eq('event_id', entityId);
    } else if (entityId) {
      query = query.eq('metadata->>entityId', String(entityId));
    } else {
      // Sem entidade não há como garantir duplicidade com segurança.
      return false;
    }

    const { data, error } = await query.limit(1).maybeSingle();

    if (error) {
      console.error('[checkAutomationDuplicate] Erro ao verificar duplicidade:', error);
      // Em caso de erro, não bloquear o envio (fail open)
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('[checkAutomationDuplicate] Exceção ao verificar duplicidade:', err);
    // Em caso de exceção, não bloquear o envio
    return false;
  }
}
