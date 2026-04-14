import { getRankedSuggestions, VALID_SOURCE_TYPES } from '@/lib/sugestoes/ranked-suggestions';

const DEFAULT_COLLECTION_LIMIT = 12;

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
    is_recommended: Boolean(song?.is_recommended),
    usage_count: Number(song?.usage_count || 0),
    smart_score: Number(song?.smart_score || 0),
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

function getSongAgeInDays(song) {
  const createdAt = new Date(song?.created_at || '').getTime();
  if (Number.isNaN(createdAt)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - createdAt) / (1000 * 60 * 60 * 24));
}

function takeTopRanked(items, limit) {
  return items.slice(0, limit);
}

export async function getAutomaticSuggestionCollections(supabase, options = {}) {
  const limit = Number(options?.limit || DEFAULT_COLLECTION_LIMIT);

  const rankedCatalog = await getRankedSuggestions(supabase, {
    limit: 400,
    weights: options?.weights,
  });

  const mostSelected = takeTopRanked(rankedCatalog, limit);
  const featured = takeTopRanked(rankedCatalog.filter((song) => song?.is_featured), limit);
  const gospelCeremony = takeTopRanked(
    rankedCatalog.filter(
      (song) =>
        normalizeText(song?.genre?.slug) === 'gospel' &&
        normalizeText(song?.moment?.slug) === 'cerimonia'
    ),
    limit
  );
  const romanticEntrance = takeTopRanked(
    rankedCatalog.filter(
      (song) =>
        normalizeText(song?.genre?.slug) === 'romantico' &&
        normalizeText(song?.moment?.slug) === 'entrada'
    ),
    limit
  );
  const recentlyImported = takeTopRanked(
    rankedCatalog
      .filter((song) => song?.source_type === 'imported')
      .sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime()),
    limit
  );

  const relevantNews = takeTopRanked(
    rankedCatalog
      .filter((song) => getSongAgeInDays(song) <= 120)
      .sort((a, b) => b.smart_score - a.smart_score),
    limit
  );

  const gospelItems = gospelCeremony.length
    ? gospelCeremony
    : fallbackByNameOrSlug(rankedCatalog, {
        genreTerms: ['gospel'],
        momentTerms: ['cerimonia', 'cerimônia'],
      }).slice(0, limit);

  const romanticItems = romanticEntrance.length
    ? romanticEntrance
    : fallbackByNameOrSlug(rankedCatalog, {
        genreTerms: ['romantico', 'romântico'],
        momentTerms: ['entrada'],
      }).slice(0, limit);

  return [
    buildCollection(
      'mais-escolhidas',
      'Mais escolhidas',
      'Músicas ranqueadas por score inteligente (uso + curadoria + recência).',
      mostSelected
    ),
    buildCollection(
      'destaques',
      'Destaques',
      'Faixas destacadas manualmente, ordenadas por score inteligente.',
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
      'Novidades relevantes',
      'Músicas mais novas e relevantes no catálogo válido, com score inteligente.',
      relevantNews
    ),
  ];
}

export { VALID_SOURCE_TYPES as EDITORIAL_SOURCE_TYPES };
