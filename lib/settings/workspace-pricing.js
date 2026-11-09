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

// Regras oficiais de preço (quote_price_rules) do workspace, sem custos internos (musician_fee):
// seguras para telas de cliente e para membros. Retorna { data, error }.
export async function loadWorkspaceOfficialPriceRules({ supabase, workspaceId = null, eventId = null }) {
  try {
    const resolvedWorkspaceId = workspaceId || (await resolveEventWorkspaceId(supabase, eventId));
    if (!resolvedWorkspaceId) return { data: [], error: null };
    return await supabase
      .from('quote_price_rules')
      .select('category, item_key, amount, valid_from, valid_until')
      .eq('workspace_id', resolvedWorkspaceId)
      .in('category', ['ceremony', 'reception', 'sound', 'transport']);
  } catch (error) {
    return { data: [], error };
  }
}
