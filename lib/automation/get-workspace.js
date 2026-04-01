import { getSupabaseAdmin } from '../supabase-admin';

/**
 * Retorna o workspace padrão do sistema
 * Busca primeiro workspace ativo ou com key='default'
 * @returns {Promise<string|null>} ID do workspace padrão
 */
export async function getDefaultWorkspace() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[getDefaultWorkspace] Erro ao buscar workspace:', error);
      return null;
    }

    return data?.id ?? null;
  } catch (err) {
    console.error('[getDefaultWorkspace] Exceção ao buscar workspace:', err);
    return null;
  }
}
