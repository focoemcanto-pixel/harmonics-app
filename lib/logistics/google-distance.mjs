/**
 * Distância rodoviária via Google (Geocoding + Distance Matrix). Extraído de
 * app/api/quotes/analyze para reuso pelo módulo Orçamentos e pela IA comercial.
 */
export const DEFAULT_LOGISTICS_ORIGIN = process.env.HARMONICS_LOGISTICS_ORIGIN || 'Salvador, BA, Brasil';

export async function geocode(query, key, fetchImpl = fetch) {
  const u = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  u.searchParams.set('address', query); u.searchParams.set('region', 'br'); u.searchParams.set('key', key);
  const j = await fetchImpl(u, { cache: 'no-store' }).then((r) => r.json());
  const x = j.results?.[0];
  if (!x) return null;
  return { address: x.formatted_address, lat: x.geometry.location.lat, lng: x.geometry.location.lng, placeId: x.place_id };
}

export async function route(origin, destination, key, fetchImpl = fetch) {
  const u = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
  u.searchParams.set('origins', origin); u.searchParams.set('destinations', destination);
  u.searchParams.set('region', 'br'); u.searchParams.set('language', 'pt-BR'); u.searchParams.set('key', key);
  const j = await fetchImpl(u, { cache: 'no-store' }).then((r) => r.json());
  const x = j.rows?.[0]?.elements?.[0];
  if (!x || x.status !== 'OK') return null;
  return { distanceKm: Math.round(x.distance.value / 100) / 10, travelMinutes: Math.round(x.duration.value / 60), distanceText: x.distance.text, durationText: x.duration.text };
}

/** routeFn para a IA: null quando não há chave (logística fica para revisão humana). */
export function createRouteFn({ env = process.env, fetchImpl = fetch } = {}) {
  const key = String(env.GOOGLE_MAPS_KEY || '').trim();
  if (!key) return null;
  const cache = new Map();
  return async (location, origin) => {
    const from = origin || DEFAULT_LOGISTICS_ORIGIN;
    const cacheKey = `${from}|${location}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const place = await geocode(location, key, fetchImpl);
    const result = place ? await route(from, place.address, key, fetchImpl) : null;
    cache.set(cacheKey, result);
    return result;
  };
}
