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
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const a = candidate.address || {};
  const state = String(a.state || '').trim();
  const uf = state.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'bahia' ? 'BA' : null;
  return {
    name: String(candidate.name || candidate.namedetails?.name || candidate.display_name?.split(',')[0] || '').slice(0, 120),
    address: String(candidate.display_name || '').slice(0, 240),
    lat, lng, uf, state, source: 'openstreetmap',
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
export async function lookupVenueOnline({ venue, city, fetchImpl = fetch, now = () => Date.now() } = {}) {
  if (!valid(venue, 120) || !valid(city, 80)) return { status: 'unavailable', reason: 'insufficient_query' };
  const key = normalize(venue) + '|' + normalize(city);
  const instant = now();
  const hit = cache.get(key);
  if (hit && hit.expires > instant) return { ...hit.value, cached: true };
  // Limite conservador por processo, além do cache. Não usar o servidor público para busca em lote.
  if (instant - lastLookupMs < 2000) return { status: 'unavailable', reason: 'rate_limited' };
  lastLookupMs = instant;
  const params = new URLSearchParams({
    q: venue.trim() + ', ' + city.trim() + ', Brasil',
    format: 'jsonv2', addressdetails: '1', namedetails: '1',
    countrycodes: 'br', limit: '5', 'accept-language': 'pt-BR',
  });
  try {
    const res = await fetchImpl('https://nominatim.openstreetmap.org/search?' + params, {
      method: 'GET',
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
    const matches = list.filter((r) => matchesVenue(r, venue) && matchesCity(r, city))
      .map(mapCandidate).filter(Boolean);
    const result = matches.length === 1
      ? { status: 'found', venue: matches[0], attribution: VENUE_WEB_ATTRIBUTION }
      : matches.length > 1
        ? { status: 'ambiguous', attribution: VENUE_WEB_ATTRIBUTION }
        : { status: 'not_found', attribution: VENUE_WEB_ATTRIBUTION };
    if (cache.size > 400) cache.clear();
    cache.set(key, { value: result, expires: instant + CACHE_MS });
    return result;
  } catch {
    return { status: 'unavailable', reason: 'network_error' };
  }
}
