const cacheStore = new Map();

function now() {
  return Date.now();
}

export function readCachedValue(key) {
  const entry = cacheStore.get(key);
  if (!entry || entry.data === undefined) return undefined;
  if (entry.expiresAt && entry.expiresAt < now()) return undefined;
  return entry.data;
}

export function invalidateCache(keyOrPrefix) {
  if (!keyOrPrefix) return;
  for (const key of cacheStore.keys()) {
    if (key === keyOrPrefix || key.startsWith(`${keyOrPrefix}:`)) {
      cacheStore.delete(key);
    }
  }
}

export async function cachedPromise(key, fetcher, options = {}) {
  const { ttlMs = 30_000, force = false } = options;
  const entry = cacheStore.get(key);

  if (!force && entry?.data !== undefined && (!entry.expiresAt || entry.expiresAt > now())) {
    return entry.data;
  }

  if (!force && entry?.promise) {
    return entry.promise;
  }

  const promise = (async () => {
    try {
      const data = await fetcher();
      cacheStore.set(key, {
        data,
        expiresAt: ttlMs > 0 ? now() + ttlMs : null,
        promise: null,
      });
      return data;
    } catch (error) {
      const previous = cacheStore.get(key);
      if (previous?.data !== undefined) {
        cacheStore.set(key, {
          data: previous.data,
          expiresAt: previous.expiresAt,
          promise: null,
        });
      } else {
        cacheStore.delete(key);
      }
      throw error;
    }
  })();

  cacheStore.set(key, {
    data: entry?.data,
    expiresAt: entry?.expiresAt,
    promise,
  });

  return promise;
}
