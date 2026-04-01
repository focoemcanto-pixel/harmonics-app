import { getSupabaseAdmin } from '../supabase-admin';

/**
 * Retorna o workspace padrão do sistema
 * Busca primeiro workspace ativo ou com key='default'
 * @returns {Promise<string|null>} ID do workspace ou null se não encontrado
 */
export async function getDefaultWorkspace() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .or('key.eq.default,is_active.eq.true')
      .order('key', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[getDefaultWorkspace] Erro ao buscar workspace padrão:', error);
      return null;
    }

    return data?.id ?? null;
  } catch (err) {
    console.error('[getDefaultWorkspace] Exceção ao buscar workspace padrão:', err);
    return null;
  }
}
