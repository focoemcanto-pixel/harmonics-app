import { getSupabaseAdmin } from '../supabase-admin';

/**
 * Verifica se já existe envio para evitar duplicidade
 * @param {string} workspaceId
 * @param {string} ruleId
 * @param {string} entityId
 * @param {string} recipientNumber
 * @returns {Promise<boolean>} true se já existe envio
 */
export async function checkAutomationDuplicate(workspaceId, ruleId, entityId, recipientNumber) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    let query = supabaseAdmin
      .from('automation_logs')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('rule_id', ruleId)
      .eq('recipient', recipientNumber)
      .eq('status', 'sent');

    if (entityId) {
      query = query.eq('entity_id', entityId);
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
