import { getSupabaseAdmin } from '../supabase-admin';

/**
 * Resolve o workspace_settings padrão ativo.
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @returns {Promise<{id: string}>}
 */
export async function getDefaultWorkspaceSettings(supabase = null) {
  const client = supabase || getSupabaseAdmin();

  const { data, error } = await client
    .from('workspace_settings')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error('Workspace settings não encontrado');
  }

  return data;
}

/**
 * Resolve um workspace_settings válido para uso em colunas workspace_id.
 * Se candidateId vier inválido/inexistente, cai para o workspace_settings padrão.
 */
export async function resolveWorkspaceSettings(candidateId, supabase = null) {
  const client = supabase || getSupabaseAdmin();

  if (candidateId) {
    const { data, error } = await client
      .from('workspace_settings')
      .select('id')
      .eq('id', candidateId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw new Error(`[resolveWorkspaceSettings] Erro ao validar workspace_settings por id: ${error.message}`);
    }

    if (data?.id) {
      return data;
    }

    console.warn('[resolveWorkspaceSettings] workspace_settings informado não encontrado/ativo; usando default', {
      informed_workspace_settings_id: candidateId,
    });
  }

  return getDefaultWorkspaceSettings(client);
}
