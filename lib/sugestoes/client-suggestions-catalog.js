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

// Catálogo da aba Sugestões do painel do cliente:
// - exibe somente curadoria oficial ativa (source_type=admin, is_active=true).
export async function fetchClientSuggestionsCatalog(supabase) {
  console.info('[sugestoes] songs query (client)', {
    table: 'public.suggestion_songs',
    sourceFilter: 'source_type=admin AND is_active=true',
    dataOrigin: 'editorial_catalog_only',
  });

  const { data, error } = await buildSuggestionsBaseQuery(supabase)
    .eq('source_type', 'admin')
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

  console.info('[sugestoes] songs query result', {
    count: (data || []).length,
    table: 'public.suggestion_songs',
    dataOrigin: 'editorial_catalog_only',
  });

  return data || [];
}

// Catálogo oficial de curadoria no admin:
// - inclui apenas source_type em (admin, imported)
// - não exclui inativas; o filtro de status é aplicado na UI.
export async function fetchAdminEditorialCatalog(supabase) {
  console.info('[sugestoes] songs query (admin)', {
    table: 'public.suggestion_songs',
    sourceFilter: 'source_type IN (admin, imported)',
    dataOrigin: 'editorial_catalog_only',
  });

  const { data, error } = await buildSuggestionsBaseQuery(supabase)
    .in('source_type', ['admin', 'imported']);

  if (error) {
    console.error('[sugestoes] admin songs query failed; returning empty catalog fallback', {
      table: 'public.suggestion_songs',
      message: error?.message || 'unknown error',
      details: error?.details || null,
      hint: error?.hint || null,
      code: error?.code || null,
    });
    return [];
  }

  console.info('[sugestoes] admin songs query result', {
    count: (data || []).length,
    table: 'public.suggestion_songs',
    dataOrigin: 'editorial_catalog_only',
  });

  return data || [];
}
