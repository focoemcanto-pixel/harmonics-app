import { getSupabaseAdmin } from '../supabase-admin';

/**
 * Busca regras ativas por workspace e tipo de evento
 * @param {string} workspaceId
 * @param {string} eventType
 * @returns {Promise<Array>} regras ativas
 */
export async function getActiveRules(workspaceId, eventType) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('automation_rules')
      .select(
        `id, workspace_id, key, name, event_type, recipient_type,
         template_id, channel_id, days_before, days_after, send_time,
         is_active, created_at`
      )
      .eq('workspace_id', workspaceId)
      .eq('event_type', eventType)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[getActiveRules] Erro ao buscar regras ativas:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[getActiveRules] Exceção ao buscar regras ativas:', err);
    return [];
  }
}
