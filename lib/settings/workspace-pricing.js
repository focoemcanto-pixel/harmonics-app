// Preços (pricing_settings) e custos padrão (finance_cost_defaults) por workspace.
//
// Regras:
// - Linha do workspace (workspace_id) é a fonte de verdade.
// - Linha legada (slug "default", workspace_id nulo) só é usada como fallback quando o
//   workspace não pôde ser determinado — nunca para um workspace conhecido de outro tenant.
// - Retornam { data, error } para encaixar nos Promise.all existentes.

async function resolveEventWorkspaceId(supabase, eventId) {
  const id = String(eventId || '').trim();
  if (!id) return null;
  const { data } = await supabase.from('events').select('workspace_id').eq('id', id).maybeSingle();
  return data?.workspace_id ? String(data.workspace_id) : null;
}

async function loadScopedRow({ supabase, table, select, workspaceId }) {
  if (workspaceId) {
    return supabase.from(table).select(select).eq('workspace_id', workspaceId).maybeSingle();
  }
  return supabase.from(table).select(select).eq('slug', 'default').maybeSingle();
}

export async function loadWorkspacePricing({ supabase, workspaceId = null, eventId = null, select = '*' }) {
  try {
    const resolvedWorkspaceId = workspaceId || (await resolveEventWorkspaceId(supabase, eventId));
    return await loadScopedRow({ supabase, table: 'pricing_settings', select, workspaceId: resolvedWorkspaceId });
  } catch (error) {
    return { data: null, error };
  }
}

export async function loadWorkspaceCostDefaults({ supabase, workspaceId = null, eventId = null, select = '*' }) {
  try {
    const resolvedWorkspaceId = workspaceId || (await resolveEventWorkspaceId(supabase, eventId));
    return await loadScopedRow({ supabase, table: 'finance_cost_defaults', select, workspaceId: resolvedWorkspaceId });
  } catch (error) {
    return { data: null, error };
  }
}

// Slug usado para linhas novas por workspace (a constraint UNIQUE(slug) legada continua válida).
export function workspaceSettingsSlug(workspaceId) {
  return `ws-${String(workspaceId)}`;
}
