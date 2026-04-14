// Compatibilidade temporária:
// - mantém admin + null para catálogos legados;
// - inclui imported para a migração gradual da curadoria;
// - não inclui client para não exibir catálogo do cliente no painel do cliente.
const CLIENT_SUGGESTIONS_SOURCE_FILTER =
  'source_type.eq.admin,source_type.eq.imported,source_type.is.null';

export async function fetchClientSuggestionsCatalog(supabase) {
  console.info('[sugestoes] songs query', {
    table: 'public.suggestion_songs',
    sourceFilter: CLIENT_SUGGESTIONS_SOURCE_FILTER,
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
    .or(CLIENT_SUGGESTIONS_SOURCE_FILTER)
    .order('created_at', { ascending: false });

  if (error) throw error;

  console.info('[sugestoes] songs query result', {
    count: (data || []).length,
    table: 'public.suggestion_songs',
    dataOrigin: 'editorial_catalog_only',
  });

  return data || [];
}
