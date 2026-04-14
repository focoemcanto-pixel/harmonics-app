const VALID_SOURCE_TYPES = ['admin', 'imported'];

export const SMART_RANKING_WEIGHTS = {
  usageMultiplier: 10,
  featuredBonus: 20,
  recommendedBonus: 15,
  importedBonus: 4,
  maxRecencyBonus: 8,
  recencyWindowDays: 60,
};

const RANKED_SELECT_FIELDS = `
  id,
  title,
  artist,
  youtube_id,
  thumbnail_url,
  description,
  usage_count,
  is_featured,
  is_recommended,
  is_active,
  source_type,
  created_at,
  genre:suggestion_genres(id, name, slug),
  moment:suggestion_moments(id, name, slug)
`;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getSongAgeInDays(createdAt, nowMs) {
  if (!createdAt) return null;

  const createdAtMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdAtMs)) return null;

  const diffMs = Math.max(0, nowMs - createdAtMs);
  return diffMs / (1000 * 60 * 60 * 24);
}

function getRecencyBonus(song, nowMs, weights) {
  const ageInDays = getSongAgeInDays(song?.created_at, nowMs);
  if (ageInDays === null) return 0;

  const windowDays = Math.max(1, toNumber(weights?.recencyWindowDays));
  if (ageInDays >= windowDays) return 0;

  const progress = 1 - ageInDays / windowDays;
  const rawBonus = progress * toNumber(weights?.maxRecencyBonus);

  return Math.max(0, Math.round(rawBonus * 100) / 100);
}

export function calculateSmartSuggestionScore(song = {}, options = {}) {
  const weights = {
    ...SMART_RANKING_WEIGHTS,
    ...(options?.weights || {}),
  };
  const nowMs = options?.nowMs || Date.now();

  const usageScore = toNumber(song?.usage_count) * toNumber(weights.usageMultiplier);
  const featuredScore = song?.is_featured ? toNumber(weights.featuredBonus) : 0;
  const recommendedScore = song?.is_recommended ? toNumber(weights.recommendedBonus) : 0;
  const importedScore = song?.source_type === 'imported' ? toNumber(weights.importedBonus) : 0;
  const recencyScore = getRecencyBonus(song, nowMs, weights);

  const total = usageScore + featuredScore + recommendedScore + importedScore + recencyScore;

  return Math.round(total * 100) / 100;
}

function bySmartScoreDesc(a, b) {
  if (b.smart_score !== a.smart_score) return b.smart_score - a.smart_score;

  const usageDiff = toNumber(b?.usage_count) - toNumber(a?.usage_count);
  if (usageDiff !== 0) return usageDiff;

  const createdAtA = new Date(a?.created_at || 0).getTime();
  const createdAtB = new Date(b?.created_at || 0).getTime();
  return createdAtB - createdAtA;
}

export async function getRankedSuggestions(supabase, options = {}) {
  const limit = Number(options?.limit || 200);
  const weights = options?.weights || SMART_RANKING_WEIGHTS;

  const { data, error } = await supabase
    .from('suggestion_songs')
    .select(RANKED_SELECT_FIELDS)
    .in('source_type', VALID_SOURCE_TYPES)
    .eq('is_active', true)
    .limit(limit);

  if (error) throw error;

  return (data || [])
    .map((song) => ({
      ...song,
      smart_score: calculateSmartSuggestionScore(song, { weights }),
    }))
    .sort(bySmartScoreDesc);
}

export { VALID_SOURCE_TYPES };
