import { getSupabaseAdmin } from '../supabase-admin';

/**
 * Busca canal ativo por workspaceId.
 * Prioridade:
 *   1. Canal com is_default = true e is_active = true
 *   2. Primeiro canal ativo (fallback secundário, sem default)
 *   3. null se não encontrar nenhum canal válido
 *
 * @param {string} workspaceId
 * @param {string|null} channelId - Opcional: busca canal específico por ID
 * @returns {Promise<Object|null>}
 */
export async function getChannel(workspaceId, channelId = null) {
  try {
    if (!workspaceId) {
      console.warn('[getChannel] workspaceId não informado — canal não será buscado');
      return null;
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Busca por ID específico quando informado
    if (channelId) {
      const { data, error } = await supabaseAdmin
        .from('whatsapp_channels')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .eq('id', channelId)
        .maybeSingle();

      if (error) {
        console.error('[getChannel] Erro ao buscar canal por ID:', error);
        return null;
      }
      return data ?? null;
    }

    // Busca todos os canais ativos ordenando default primeiro
    const { data, error } = await supabaseAdmin
      .from('whatsapp_channels')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle();

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
