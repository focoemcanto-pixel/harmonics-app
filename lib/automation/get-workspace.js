import { getSupabaseAdmin } from '../supabase-admin';

/**
 * Retorna o workspace padrão do sistema.
 * @returns {Promise<{id: string, key: string}>}
 * @throws {Error} Quando o workspace default não existe ou há erro na consulta.
 */
export async function getDefaultWorkspace() {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .select('id, key')
    .eq('key', 'default')
    .maybeSingle();

  if (error) {
    throw new Error(`[getDefaultWorkspace] Erro ao buscar workspace default: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error('[getDefaultWorkspace] Workspace default não encontrado em public.workspaces (key=default)');
  }

  return data;
}
