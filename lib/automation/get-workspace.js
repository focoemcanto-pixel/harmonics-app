import { getSupabaseAdmin } from '../supabase-admin';

/**
 * Retorna um workspace_settings válido do sistema.
 * @returns {Promise<{id: string}>}
 * @throws {Error} Quando não existe workspace_settings ou há erro na consulta.
 */
export async function getDefaultWorkspace() {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from('workspace_settings')
    .select('id')
    .limit(1);

  if (error) {
    throw new Error(`[getDefaultWorkspace] Erro ao buscar workspace_settings: ${error.message}`);
  }

  const workspace = Array.isArray(data) ? data[0] : null;

  if (!workspace?.id) {
    throw new Error('[getDefaultWorkspace] Nenhum registro encontrado em public.workspace_settings');
  }

  console.info('[automation] resolved_workspace_settings_id', {
    resolved_workspace_settings_id: workspace.id,
    source: 'workspace_settings.default',
  });

  return workspace;
}

/**
 * Resolve um workspace_settings válido para uso em colunas workspace_id.
 * Se candidateId vier inválido/inexistente, cai para o default de workspace_settings.
 */
export async function resolveWorkspaceSettings(candidateId) {
  const supabaseAdmin = getSupabaseAdmin();

  if (candidateId) {
    const { data, error } = await supabaseAdmin
      .from('workspace_settings')
      .select('id')
      .eq('id', candidateId)
      .maybeSingle();

    if (error) {
      throw new Error(`[resolveWorkspaceSettings] Erro ao validar workspace_settings por id: ${error.message}`);
    }

    if (data?.id) {
      console.info('[automation] resolved_workspace_settings_id', {
        resolved_workspace_settings_id: data.id,
        source: 'workspace_settings.by_id',
      });
      return data;
    }

    console.warn('[resolveWorkspaceSettings] workspace_settings informado não encontrado; usando default', {
      informed_workspace_settings_id: candidateId,
    });
  }

  return getDefaultWorkspace();
}
