import { getSupabaseAdmin } from '@/lib/supabase-admin';

const DEFAULT_WORKSPACE_SLUG =
  process.env.DEFAULT_WORKSPACE_SLUG || 'harmonics-producao';

export async function getDefaultWorkspace({ supabase } = {}) {
  const client = supabase || getSupabaseAdmin();

  const { data, error } = await client
    .from('workspaces')
    .select('id, name, slug, key, status, plan_key')
    .eq('slug', DEFAULT_WORKSPACE_SLUG)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar workspace padrão: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error(
      `Workspace padrão não encontrado: ${DEFAULT_WORKSPACE_SLUG}`
    );
  }

  return data;
}

export async function getWorkspaceSettings({ supabase, workspaceId }) {
  const client = supabase || getSupabaseAdmin();

  if (!workspaceId) {
    throw new Error('workspaceId é obrigatório para buscar settings.');
  }

  const { data, error } = await client
    .from('workspace_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar configurações do workspace: ${error.message}`);
  }

  return data || null;
}

export async function getCurrentWorkspace({ supabase } = {}) {
  const workspace = await getDefaultWorkspace({ supabase });
  const settings = await getWorkspaceSettings({
    supabase,
    workspaceId: workspace.id,
  });

  return {
    workspaceId: workspace.id,
    workspace,
    settings,
    role: 'owner',
    isPlatformAdmin: true,
    source: 'default_workspace_fallback',
  };
}
