import { norm } from './venues.mjs';

export const GEOAPIFY_SOURCE = 'https://www.geoapify.com/';
const localityKey = (value) => norm(value).replace(/\s/g, '');
const sameLocality = (actual, expected) => Boolean(expected) && localityKey(actual) === localityKey(expected);

export function createGeoapifyServices(apiKey, fetchImpl) {
  async function query(path, params) {
    const url = new URL(path, 'https://api.geoapify.com');
    url.search = new URLSearchParams({ ...params, apiKey });
    const response = await fetchImpl(url.toString(), { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    return response.ok ? { body: await response.json() } : { httpStatus: response.status };
  }

  return {
    provider: 'geoapify',
    geocoder: 'geoapify',
    async search({ venue, city, mode, address, uf }) {
      const result = await query('/v1/geocode/search', {
        text: [address || venue, city, uf === 'BA' ? 'Bahia' : uf, 'Brasil'].filter(Boolean).join(', '),
        filter: 'countrycode:br', lang: 'pt', format: 'json', limit: '5',
        ...(mode === 'city' ? { type: 'city' } : {}),
      });
      if (!Array.isArray(result.body?.results)) return { status: 'unavailable', httpStatus: result.httpStatus };

      const matches = new Map();
      for (const row of result.body.results) {
        const stateCode = row.state_code?.replace(/^BR-/i, '').toUpperCase() || (norm(row.state) === 'bahia' ? 'BA' : null);
        if (row.country_code !== 'br' || !row.city || !/^[A-Z]{2}$/.test(stateCode || '')
          || (city && !sameLocality(row.city, city)) || (uf && stateCode !== uf)
          || !Number.isFinite(row.lat) || Math.abs(row.lat) > 90
          || !Number.isFinite(row.lon) || Math.abs(row.lon) > 180 || !row.place_id) continue;

        const exactAddress = address && row.housenumber && row.street
          && ` ${norm(address)} `.includes(` ${norm(row.street)} `)
          && ` ${norm(address)} `.includes(` ${norm(row.housenumber)} `);
        const cityMatch = row.result_type === 'city' && sameLocality(row.city, venue);
        const venueMatch = ['amenity', 'building'].includes(row.result_type)
          && Boolean(norm(venue)) && norm(row.name) === norm(venue);
        if (mode === 'city' ? !cityMatch : mode === 'address' ? !exactAddress : !(venueMatch || exactAddress)) continue;

        matches.set(row.place_id, {
          name: mode === 'city' ? row.city : venue, city: row.city, uf: stateCode,
          address: row.formatted || '', lat: row.lat, lng: row.lon, sourceUrl: GEOAPIFY_SOURCE,
          sourceId: row.place_id, attribution: row.datasource?.attribution || null,
        });
      }
      if (matches.size !== 1) return { status: matches.size ? 'ambiguous' : 'not_found' };
      return { status: 'found', venue: matches.values().next().value };
    },
    async route({ origin, place }) {
      const [lat, lng, ...extra] = origin.split(',').map((value) => value.trim());
      if (extra.length || !lat || !lng || !Number.isFinite(Number(lat)) || Math.abs(Number(lat)) > 90
        || !Number.isFinite(Number(lng)) || Math.abs(Number(lng)) > 180) return null;

      const { body, httpStatus } = await query('/v1/routing', {
        waypoints: `${lat},${lng}|${place.lat},${place.lng}`,
        mode: 'drive', units: 'metric', format: 'json', avoid: 'ferries',
      });
      if (httpStatus) return { status: 'unavailable', httpStatus };
      const route = body?.results?.[0];
      if (route?.distance_units !== 'meters' && route?.distance_units !== 'Meters') return null;
      if (!Number.isFinite(route.distance) || !Number.isFinite(route.time)) return null;
      return { distanceKm: route.distance / 1000, travelMinutes: route.time / 60 };
    },
  };
}
