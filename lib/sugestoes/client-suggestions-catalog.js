// Catálogo da aba Sugestões do painel do cliente:
// - exibe somente músicas da curadoria oficial (source_type=admin);
// - não mistura itens de repertório/importações (client/imported)
//   nem legados sem classificação (null/empty).
export async function fetchClientSuggestionsCatalog(supabase) {
  console.info('[sugestoes] songs query', {
    table: 'public.suggestion_songs',
    sourceFilter: 'source_type=admin',
    dataOrigin: 'editorial_catalog_only',
  });

  const { data, error } = await supabase
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
    .eq('source_type', 'admin')
    .order('created_at', { ascending: false });

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
