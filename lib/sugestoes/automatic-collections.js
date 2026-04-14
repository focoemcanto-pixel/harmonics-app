const EDITORIAL_SOURCE_TYPES = ['admin', 'imported'];
const DEFAULT_COLLECTION_LIMIT = 12;

const BASE_SELECT_FIELDS = `
  id,
  title,
  artist,
  youtube_id,
  thumbnail_url,
  description,
  is_featured,
  usage_count,
  source_type,
  created_at,
  genre:suggestion_genres(id, name, slug),
  moment:suggestion_moments(id, name, slug)
`;

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeSong(song = {}) {
  return {
    id: song?.id || null,
    title: String(song?.title || ''),
    artist: String(song?.artist || ''),
    youtube_id: String(song?.youtube_id || ''),
    thumbnail_url: String(song?.thumbnail_url || ''),
    description: String(song?.description || ''),
    is_featured: Boolean(song?.is_featured),
    usage_count: Number(song?.usage_count || 0),
    source_type: String(song?.source_type || ''),
    created_at: song?.created_at || null,
  };
}

function buildCollection(id, name, description, items = []) {
  return {
    id,
    name,
    type: 'automatic',
    description,
    items: items.map(normalizeSong),
    total: items.length,
  };
}

function buildBaseQuery(supabase) {
  return supabase
    .from('suggestion_songs')
    .select(BASE_SELECT_FIELDS)
    .in('source_type', EDITORIAL_SOURCE_TYPES)
    .eq('is_active', true);
}

async function queryMostSelected(supabase, limit) {
  const { data, error } = await buildBaseQuery(supabase)
    .order('usage_count', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function queryFeatured(supabase, limit) {
  const { data, error } = await buildBaseQuery(supabase)
    .eq('is_featured', true)
    .order('usage_count', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function queryGospelCeremony(supabase, limit) {
  const { data, error } = await buildBaseQuery(supabase)
    .eq('genre.slug', 'gospel')
    .eq('moment.slug', 'cerimonia')
    .order('usage_count', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function queryRomanticEntrance(supabase, limit) {
  const { data, error } = await buildBaseQuery(supabase)
    .eq('genre.slug', 'romantico')
    .eq('moment.slug', 'entrada')
    .order('usage_count', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function queryRecentlyImported(supabase, limit) {
  const { data, error } = await buildBaseQuery(supabase)
    .eq('source_type', 'imported')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function queryRecentNews(supabase, limit) {
  const { data, error } = await buildBaseQuery(supabase)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

function fallbackByNameOrSlug(catalog, { genreTerms = [], momentTerms = [] }) {
  const normalizedGenreTerms = genreTerms.map(normalizeText);
  const normalizedMomentTerms = momentTerms.map(normalizeText);

  return catalog.filter((song) => {
    const genreName = normalizeText(song?.genre?.name);
    const genreSlug = normalizeText(song?.genre?.slug);
    const momentName = normalizeText(song?.moment?.name);
    const momentSlug = normalizeText(song?.moment?.slug);

    const matchesGenre = normalizedGenreTerms.some(
      (term) => genreName.includes(term) || genreSlug.includes(term)
    );
    const matchesMoment = normalizedMomentTerms.some(
      (term) => momentName.includes(term) || momentSlug.includes(term)
    );

    return matchesGenre && matchesMoment;
  });
}

export async function getAutomaticSuggestionCollections(supabase, options = {}) {
  const limit = Number(options?.limit || DEFAULT_COLLECTION_LIMIT);

  const [
    mostSelected,
    featured,
    gospelCeremony,
    romanticEntrance,
    recentlyImported,
    news,
    baseCatalogForFallback,
  ] = await Promise.all([
    queryMostSelected(supabase, limit),
    queryFeatured(supabase, limit),
    queryGospelCeremony(supabase, limit),
    queryRomanticEntrance(supabase, limit),
    queryRecentlyImported(supabase, limit),
    queryRecentNews(supabase, limit),
    buildBaseQuery(supabase)
      .order('usage_count', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) throw error;
        return data || [];
      }),
  ]);

  const gospelItems = gospelCeremony.length
    ? gospelCeremony
    : fallbackByNameOrSlug(baseCatalogForFallback, {
        genreTerms: ['gospel'],
        momentTerms: ['cerimonia', 'cerimônia'],
      }).slice(0, limit);

  const romanticItems = romanticEntrance.length
    ? romanticEntrance
    : fallbackByNameOrSlug(baseCatalogForFallback, {
        genreTerms: ['romantico', 'romântico'],
        momentTerms: ['entrada'],
      }).slice(0, limit);

  return [
    buildCollection(
      'mais-escolhidas',
      'Mais escolhidas',
      'Músicas com maior uso histórico na curadoria editorial.',
      mostSelected
    ),
    buildCollection(
      'destaques',
      'Destaques',
      'Faixas destacadas manualmente pelo time editorial.',
      featured
    ),
    buildCollection(
      'gospel-cerimonia',
      'Gospel cerimônia',
      'Curadoria gospel para momentos de cerimônia.',
      gospelItems
    ),
    buildCollection(
      'entrada-romantica',
      'Entrada romântica',
      'Seleções românticas para entrada.',
      romanticItems
    ),
    buildCollection(
      'importadas-recentemente',
      'Importadas recentemente',
      'Últimas músicas importadas para o catálogo editorial.',
      recentlyImported
    ),
    buildCollection(
      'novidades',
      'Novidades',
      'Adições mais recentes no catálogo editorial válido.',
      news
    ),
  ];
}

export { EDITORIAL_SOURCE_TYPES };
