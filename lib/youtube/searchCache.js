const DEFAULT_TTL_MS = 5 * 60 * 1000;

const cacheStore = new Map();

export function normalizeYoutubeSearchQuery(query) {
  return String(query || '').trim().toLowerCase();
}

export function getYoutubeSearchCache(query) {
  const normalizedQuery = normalizeYoutubeSearchQuery(query);
  const entry = cacheStore.get(normalizedQuery);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cacheStore.delete(normalizedQuery);
    return null;
  }

  return entry.value;
}

export function setYoutubeSearchCache(query, value, ttlMs = DEFAULT_TTL_MS) {
  const normalizedQuery = normalizeYoutubeSearchQuery(query);

  cacheStore.set(normalizedQuery, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}
