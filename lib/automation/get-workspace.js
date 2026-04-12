import { getSupabaseAdmin } from '../supabase-admin';

/**
 * Resolve o workspace padrão real (public.workspaces), que é o FK usado
 * nas tabelas de automação (rules/channels/logs/cron_runs).
 * @returns {Promise<{id: string}>}
 * @throws {Error} Quando não existe workspace ou há erro na consulta.
 */
export async function getDefaultWorkspace() {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .eq('key', 'default')
    .eq('is_active', true)
    .limit(1);

  if (error) {
    throw new Error(`[getDefaultWorkspace] Erro ao buscar workspace padrão em workspaces: ${error.message}`);
  }

  const workspace = Array.isArray(data) ? data[0] : null;

  if (!workspace?.id) {
    // Fallback defensivo: primeiro workspace ativo.
    const { data: fallbackData, error: fallbackError } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1);

    if (fallbackError) {
      throw new Error(`[getDefaultWorkspace] Erro ao buscar fallback em workspaces: ${fallbackError.message}`);
    }

    const fallbackWorkspace = Array.isArray(fallbackData) ? fallbackData[0] : null;
    if (!fallbackWorkspace?.id) {
      throw new Error('[getDefaultWorkspace] Nenhum registro encontrado em public.workspaces');
    }

    console.info('[automation] resolved_workspace_id', {
      resolved_workspace_id: fallbackWorkspace.id,
      source: 'workspaces.fallback_first_active',
    });

    return fallbackWorkspace;
  }

  console.info('[automation] resolved_workspace_id', {
    resolved_workspace_id: workspace.id,
    source: 'workspaces.default_key',
  });

  return workspace;
}

/**
 * Resolve um workspace válido para uso em colunas workspace_id (FK -> public.workspaces.id).
 * Se candidateId vier inválido/inexistente, cai para o workspace padrão.
 */
export async function resolveWorkspaceSettings(candidateId) {
  const supabaseAdmin = getSupabaseAdmin();

  if (candidateId) {
    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('id', candidateId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw new Error(`[resolveWorkspaceSettings] Erro ao validar workspace por id: ${error.message}`);
    }

    if (data?.id) {
      console.info('[automation] resolved_workspace_id', {
        resolved_workspace_id: data.id,
        source: 'workspaces.by_id',
      });
      return data;
    }

    console.warn('[resolveWorkspaceSettings] workspace informado não encontrado/ativo; usando default', {
      informed_workspace_id: candidateId,
    });
  }

  return getDefaultWorkspace();
}
