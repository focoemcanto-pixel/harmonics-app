import { getSupabaseAdmin } from '../supabase-admin';

/**
 * Busca canal ativo por workspaceId
 * Stub para Fase 4 - Canais Configuráveis
 * @param {string} workspaceId
 * @param {string|null} channelId - Opcional, se null busca default ativo
 * @returns {Promise<Object|null>}
 */
export async function getChannel(workspaceId, channelId = null) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    let query = supabaseAdmin
      .from('whatsapp_channels')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true);

    if (channelId) {
      query = query.eq('id', channelId);
    } else {
      query = query.eq('is_default', true);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('[getChannel] Erro ao buscar canal:', error);
      return null;
    }

    return data ?? null;
  } catch (err) {
    console.error('[getChannel] Exceção ao buscar canal:', err);
    return null;
  }
}
