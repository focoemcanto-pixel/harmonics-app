// Busca online pontual por espaço + cidade, sem Google Maps ou chave paga.
// Fonte: OpenStreetMap/Nominatim. Nunca confundir nome de espaço com resultado de cidade.
// A API pública exige identificação, cache, atribuição e uso leve. Consulte a política oficial.
const cache = new Map();
const CACHE_MS = 24 * 60 * 60 * 1000;
let lastLookupMs = 0;
const normalize = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const valid = (v, max) => typeof v === 'string' && v.trim().length >= 3 && v.trim().length <= max;

export const VENUE_WEB_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';

function matchesVenue(candidate, requested) {
  const names = [
    candidate.name, candidate.namedetails?.name,
    candidate.namedetails?.['name:pt'], candidate.display_name?.split(',')[0],
  ].map(normalize).filter(Boolean);
  const want = normalize(requested);
  return names.some((n) => n === want);
}
function matchesCity(candidate, requested) {
  const a = candidate.address || {};
  const cities = [a.city, a.town, a.village, a.municipality, a.county].map(normalize).filter(Boolean);
  return cities.includes(normalize(requested));
}
function mapCandidate(candidate) {
  const lat = Number(candidate.lat), lng = Number(candidate.lon);
  if (candidate.lat == null || candidate.lon == null || candidate.lat === '' || candidate.lon === '') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const a = candidate.address || {};
  const state = String(a.state || '').trim();
  const uf = /^BR-([A-Z]{2})$/.exec(a['ISO3166-2-lvl4'] || '')?.[1] || (normalize(state) === 'bahia' ? 'BA' : null);
  return {
    name: String(candidate.name || candidate.namedetails?.name || candidate.display_name?.split(',')[0] || '').slice(0, 120),
    address: String(candidate.display_name || '').slice(0, 240),
    lat, lng, uf, state, city: a.city || a.town || a.municipality || a.village, source: 'openstreetmap',
    sourceUrl: candidate.osm_type && candidate.osm_id
      ? 'https://www.openstreetmap.org/' + ({node:'node',way:'way',relation:'relation'}[candidate.osm_type] || 'node') + '/' + Number(candidate.osm_id)
      : null,
  };
}

/**
 * status: found | ambiguous | not_found | unavailable.
 * Uma busca, no máximo 5 resultados, uma única fonte pública e SEM inferir rotas.
 * 'found' só quando um único POI com nome E cidade exatamente compatíveis.
 */
export async function lookupVenueOnline({ venue, city, mode = 'venue', address, uf, endpoint, workspaceId, fetchImpl = fetch, now = () => Date.now() } = {}) {
  const extended = Boolean(endpoint);
  if (address && !valid(address, 240)) return { status: 'unavailable', reason: 'invalid_address' };
  if (!valid(venue, 120) || (city ? !valid(city, 80) : !extended)) return { status: 'unavailable', reason: 'insufficient_query' };
  const base = endpoint || 'https://nominatim.openstreetmap.org';
  const key = JSON.stringify([base, workspaceId, mode, uf, normalize(venue), normalize(city), normalize(address)]);
  const instant = now();
  const hit = extended ? null : cache.get(key);
  if (hit && hit.expires > instant) return { ...hit.value, cached: true };
  // Limite conservador por processo, além do cache. Não usar o servidor público para busca em lote.
  if (!extended && instant - lastLookupMs < 2000) return { status: 'unavailable', reason: 'rate_limited' };
  if (!extended) lastLookupMs = instant;
  const params = new URLSearchParams({
    q: [address || venue.trim(), city?.trim(), uf, 'Brasil'].filter(Boolean).join(', '),
    format: 'jsonv2', addressdetails: '1', namedetails: '1',
    countrycodes: 'br', limit: '5', 'accept-language': 'pt-BR',
  });
  try {
    const url = new URL(base);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return { status: 'unavailable', reason: 'provider_config' };
    const res = await fetchImpl(base.replace(/\/$/, '') + '/search?' + params, {
      method: 'GET', redirect: 'error',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Harmonics-Nara/1.0 (https://bandaharmonics.com)',
        Referer: 'https://bandaharmonics.com/',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { status: 'unavailable', reason: 'provider_http_' + res.status };
    const list = await res.json();
    if (!Array.isArray(list)) return { status: 'unavailable', reason: 'invalid_response' };
    const matches = list.filter((r) => {
      if (city && !matchesCity(r, city)) return false;
      if (mode === 'city') return matchesVenue(r, venue) &&
        (['city', 'town', 'municipality'].includes(r.addresstype) || ['city', 'town', 'municipality'].includes(r.type));
      if (mode === 'address') {
        const house = r.address?.house_number;
        const road = r.address?.road || r.address?.pedestrian;
        const requested = ` ${normalize(address)} `;
        return Boolean(house && road && requested.includes(` ${normalize(house)} `) &&
          requested.includes(` ${normalize(road)} `));
      }
      if (address && !normalize(r.display_name).includes(normalize(address))) return false;
      return matchesVenue(r, venue) && (r.category || r.class) !== 'boundary' &&
        !['city', 'town', 'municipality', 'administrative'].includes(r.type);
    }).map(mapCandidate).filter((place) => place && (!uf || place.uf === uf));
    if (mode === 'city') for (const match of matches) match.city = match.name;
    const result = matches.length === 1
      ? { status: 'found', venue: matches[0], attribution: VENUE_WEB_ATTRIBUTION }
      : matches.length > 1
        ? { status: 'ambiguous', attribution: VENUE_WEB_ATTRIBUTION }
        : { status: 'not_found', attribution: VENUE_WEB_ATTRIBUTION };
    if (!extended) {
      if (cache.size > 400) cache.clear();
      cache.set(key, { value: result, expires: instant + CACHE_MS });
    }
    return result;
  } catch {
    return { status: 'unavailable', reason: 'network_error' };
  }
}
