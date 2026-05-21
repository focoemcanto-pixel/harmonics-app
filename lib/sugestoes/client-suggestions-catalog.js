import { isMissingWorkspaceColumnError, logSuggestionScope, stripCrossWorkspaceRelations } from '@/lib/sugestoes/workspace-scope';

function buildSuggestionsBaseQuery(supabase) {
  return supabase
    .from('suggestion_songs')
    .select(`
      id,
      title,
      artist,
      genre_id,
      moment_id,
      youtube_url,
      youtube_id,
      thumbnail_url,
      description,
      event_types,
      moments,
      styles,
      moods,
      priority_score,
      is_recommended,
      usage_count,
      is_featured,
      is_active,
      source_type,
      sort_order,
      created_at,
      updated_at,
      genre:suggestion_genres(id, name, slug, is_active, sort_order),
      moment:suggestion_moments(id, name, slug, is_active, sort_order),
      song_tags:suggestion_song_tags(
        id,
        tag:suggestion_tags(id, name, slug, is_active)
      ),
      collection_links:suggestion_collection_songs(
        id,
        sort_order,
        collection:suggestion_collections(id, name, slug, is_active, sort_order)
      )
    `)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
}

function requireWorkspaceId(workspaceId) {
  const normalized = String(workspaceId || '').trim();
  if (!normalized) {
    console.warn('[sugestoes] blocked workspace-scoped catalog read without workspaceId');
    return null;
  }
  return normalized;
}

// Catálogo do painel do cliente:
// - usa catálogo global compartilhado (sem workspace_id).
// - exibe somente músicas ativas.
export async function fetchClientSuggestionsCatalog(supabase, { workspaceId } = {}) {
  logSuggestionScope('[sugestoes] songs query (client)', {
    table: 'public.suggestion_songs',
    sourceFilter: 'is_active=true',
    dataOrigin: 'global_catalog',
    workspaceContext: String(workspaceId || '').trim() || null,
  });

  const { data, error } = await buildSuggestionsBaseQuery(supabase)
    .eq('is_active', true);

  if (error) {
    console.error('[sugestoes] songs query failed; returning empty catalog fallback', {
      table: 'public.suggestion_songs',
      message: error?.message || 'unknown error',
      details: error?.details || null,
      hint: error?.hint || null,
      code: error?.code || null,
    });
    return [];
  }

  logSuggestionScope('[sugestoes] songs query result', {
    count: (data || []).length,
    table: 'public.suggestion_songs',
    dataOrigin: 'global_catalog',
  });

  return data || [];
}

// Catálogo editorial do admin dentro do workspace:
// - inclui apenas músicas do workspace atual.
// - não exclui inativas; o filtro de status é aplicado na UI.
export async function fetchAdminEditorialCatalog(supabase, { workspaceId } = {}) {
  const scopedWorkspaceId = requireWorkspaceId(workspaceId);
  if (!scopedWorkspaceId) return [];

  logSuggestionScope('[sugestoes] songs query (admin)', {
    table: 'public.suggestion_songs',
    sourceFilter: 'source_type IN (admin, imported)',
    dataOrigin: 'global_catalog_no_workspace_filter',
    workspaceId: scopedWorkspaceId,
  });

  const { data, error } = await buildSuggestionsBaseQuery(supabase)
    .in('source_type', ['admin', 'imported']);

  if (error) {
    if (isMissingWorkspaceColumnError(error)) {
      console.warn('[sugestoes] suggestion_songs.workspace_id missing; returning empty admin catalog to avoid cross-workspace leakage', {
        table: 'public.suggestion_songs',
        workspaceId: scopedWorkspaceId,
        message: error?.message || 'unknown error',
      });
      return [];
    }

    console.error('[sugestoes] admin songs query failed; returning empty catalog fallback', {
      table: 'public.suggestion_songs',
      message: error?.message || 'unknown error',
      details: error?.details || null,
      hint: error?.hint || null,
      code: error?.code || null,
      workspaceId: scopedWorkspaceId,
    });
    return [];
  }

  logSuggestionScope('[sugestoes] admin songs query result', {
    count: (data || []).length,
    table: 'public.suggestion_songs',
    dataOrigin: 'workspace_catalog_only',
    workspaceId: scopedWorkspaceId,
  });

  return (data || []).map((song) => stripCrossWorkspaceRelations(song, scopedWorkspaceId));
}
