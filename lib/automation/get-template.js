import { getSupabaseAdmin } from '../supabase-admin';

/**
 * Busca template por key e workspaceId
 * Stub para Fase 3 - Templates Configuráveis
 * @param {string} templateKey
 * @param {string} workspaceId
 * @returns {Promise<Object|null>}
 */
export async function getTemplate(templateKey, workspaceId) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('message_templates')
      .select('*')
      .eq('key', templateKey)
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('[getTemplate] Erro ao buscar template:', error);
      return null;
    }

    return data ?? null;
  } catch (err) {
    console.error('[getTemplate] Exceção ao buscar template:', err);
    return null;
  }
}
