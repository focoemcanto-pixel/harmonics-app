import { createHash } from 'node:crypto';
import { route as googleRoute } from '../../logistics/google-distance.mjs';
import { CUSTOM_TRIP_MINUTES, matchingAreas } from './geo.mjs';
import { lookupVenueOnline } from './venue-online.mjs';
import { lookupVenueWeb } from './venue-web-search.mjs';
import { norm, splitVenueText } from './venues.mjs';

const METRO_SOURCE = 'https://www.ba.gov.br/infraestrutura/noticia/2024-03/3024/pesquisa-de-mobilidade-da-rms';
const METRO = new Set([
  'Salvador', 'Camaçari', 'Lauro de Freitas', 'Simões Filho', 'Candeias', 'São Francisco do Conde',
  'Dias d’Ávila', 'Vera Cruz', 'São Sebastião do Passé', 'Madre de Deus', 'Pojuca', 'Mata de São João', 'Itaparica',
].map(norm));
const TTL = 7 * 86400 * 1000;
const REVIEW_TTL = 15 * 60 * 1000;
const CACHE_TABLE = 'ai_geo_cache';

function point(value) {
  if (!value || value.lat == null || value.lng == null) return false;
  const lat = Number(value.lat), lng = Number(value.lng);
  return Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180;
}

export function classifyRoadLocation({ place, routing, area, customLimit = CUSTOM_TRIP_MINUTES }) {
  if (area && ['blocked', 'conditional'].includes(area.status)) return { status: 'review' };
  if (place.uf !== 'BA' || routing.distanceKm > 120 || routing.travelMinutes > customLimit) return { status: 'custom' };
  // Preserve explicit base/fee arrangements. Owner precedence: ate120 wins over metro.
  const metro = METRO.has(norm(place.city));
  const explicitTier = area?.price_tier || (area ? 'base' : null);
  const priceTier = explicitTier && explicitTier !== 'metro' ? explicitTier : 'ate120';
  return { status: 'verified', priceTier, metro, ...(metro ? { metroSource: METRO_SOURCE } : {}),
    area: { ...(area || {}), name: area?.name || place.city, status: 'served', price_tier: priceTier } };
}

export function createRoadGeoServices({ env = process.env, fetchImpl = fetch } = {}) {
  if (env.CI || env.AI_NARA_ROAD_GEO_ENABLED !== 'true') return null;
  const endpoint = env.AI_NARA_NOMINATIM_URL;
  let nominatim;
  try {
    const url = new URL(endpoint);
    if (url.protocol === 'https:' && url.hostname !== 'nominatim.openstreetmap.org') nominatim = endpoint;
  } catch { /* Missing or invalid configuration. */ }
  const osrm = env.AI_NARA_OSRM_URL;
  const googleKey = env.GOOGLE_MAPS_KEY;
  const provider = osrm ? 'osrm' : googleKey ? 'google_distance_matrix' : null;
  return {
    provider,
    // Google routing results are excluded from persistent caching.
    cacheRoutes: provider === 'osrm',
    revision: JSON.stringify([endpoint, osrm, env.AI_NARA_MAPS_REVISION, env.AI_VENUE_WEB_SEARCH_ENABLED]),
    search: nominatim ? (args) => lookupVenueOnline({ ...args, endpoint, fetchImpl }) : null,
    webSearch: env.AI_VENUE_WEB_SEARCH_ENABLED === 'true' && env.OPENAI_API_KEY
      ? (args) => lookupVenueWeb({ ...args, env, fetchImpl }) : null,
    async route({ origin, place }) {
      if (provider === 'google_distance_matrix') {
        const result = await googleRoute(origin, `${place.lat},${place.lng}`, googleKey,
          (url, opts) => fetchImpl(url, { ...opts, signal: AbortSignal.timeout(5000), redirect: 'error' }), { exact: true });
        return result && { distanceKm: result.distanceKm, travelMinutes: result.travelMinutes };
      }
      if (provider !== 'osrm') return null;
      // OSRM requires a pinned origin in lat,lng format.
      const parts = origin.split(',').map((v) => v.trim());
      if (parts.length !== 2 || parts.some((v) => !v || !Number.isFinite(Number(v)))) return null;
      const [lat, lng] = parts.map(Number);
      if (!point({ lat, lng })) return null;
      const base = new URL(osrm);
      if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) return null;
      const path = `/route/v1/driving/${lng},${lat};${Number(place.lng)},${Number(place.lat)}`;
      const response = await fetchImpl(osrm.replace(/\/$/, '') + path + '?overview=false&alternatives=false', {
        signal: AbortSignal.timeout(5000), redirect: 'error',
        headers: { 'User-Agent': 'Harmonics-Nara/1.0 (https://bandaharmonics.com)' },
      });
      if (!response.ok) return null;
      const payload = await response.json();
      const result = payload.code === 'Ok' ? payload.routes?.[0] : null;
      if (!result || payload.waypoints?.length !== 2 || payload.waypoints.some((w) => !Number.isFinite(w.distance) || w.distance > 200)) return null;
      return { distanceKm: result.distance / 1000, travelMinutes: result.duration / 60 };
    },
  };
}

async function observe(diagnostic, provider, call) {
  const start = Date.now();
  let value;
  try { value = await call(); } catch { value = { status: 'unavailable' }; }
  diagnostic.calls.push({ provider, status: value?.status || (value ? 'found' : 'unavailable'),
    cached: value?.cached === true, latencyMs: Date.now() - start, usage: value?.cached ? null : value?.usage ?? null });
  return value;
}

const ROAD_ADDRESS = /^(?:rua|avenida|av|estrada|rodovia|travessa|alameda|praca)\b/;
const stripLocationSuffix = (value) => String(value || '').trim()
  .replace(/(?:[,/–-]\s*|\s)(?:[A-Z]{2}|[Bb]ahia|[Bb]rasil)\s*$/, '').replace(/[,/–-]$/, '').trim();

export async function resolveRoadLocation(ctx, { local, cidade, areas, gate }) {
  const services = ctx.roadGeo;
  const origin = String(ctx.settings?.logistics_rules?.origin || '').trim();
  const lead = ctx.conversation?.lead_data || {};
  const address = norm(local) === norm(lead.local) ? lead.endereco : null;
  const pointFromMemory = gate.venue?.source === 'owner' && point(gate.venue)
    && (!address || norm(gate.venue.address).startsWith(norm(address))) ? gate.venue : null;
  const locality = stripLocationSuffix(local || cidade);
  const asCity = !address && gate.action === 'proceed' && !gate.venue && (!cidade || norm(locality) === norm(stripLocationSuffix(cidade))) &&
    !/\b(igreja|capela|chacara|sitio|hotel|espaco|fazenda|salao|pousada|rua|avenida)\b/.test(norm(local));
  const parts = splitVenueText(asCity ? locality : local, cidade);
  const ufHint = parts.uf || /(?:[,/–-]\s*|\s)([A-Z]{2})$/.exec(String(local || '').trim())?.[1];
  const addressText = address || (ROAD_ADDRESS.test(norm(parts.venue)) ? locality : null);
  const mode = asCity ? 'city' : addressText && (!parts.venue || ROAD_ADDRESS.test(norm(parts.venue))) ? 'address' : 'venue';
  const args = { venue: asCity ? locality : parts.venue || addressText, city: asCity ? null : stripLocationSuffix(parts.city),
    uf: ufHint, mode, address: addressText || undefined, workspaceId: ctx.workspaceId };
  const store = ctx.geoSupabase || ctx.supabase;
  const scope = ctx.simulated ? 'simulation' : 'live';
  const key = createHash('sha256').update(JSON.stringify(['v1', services.provider, services.revision, origin,
    ufHint, norm(local), norm(cidade), norm(address), pointFromMemory?.id, pointFromMemory?.address,
    pointFromMemory?.lat, pointFromMemory?.lng])).digest('hex');
  const diagnostic = { calls: ctx.effects?.roadGeo?.calls || [], cache: 'miss', provider: services.provider };
  if (ctx.effects) ctx.effects.roadGeo = diagnostic;

  let evidence;
  let cached;
  try {
    const result = await store.from(CACHE_TABLE).select('evidence,status').eq('workspace_id', ctx.workspaceId)
      .eq('scope', scope).eq('lookup_key', key).gt('expires_at', new Date().toISOString()).maybeSingle();
    cached = result.data;
    if (result.error) diagnostic.cache = 'unavailable';
  } catch { diagnostic.cache = 'unavailable'; }
  if (cached && cached.evidence.status !== 'geocoded') {
    diagnostic.cache = 'hit';
    evidence = cached.evidence;
  } else if (!origin || !services.provider) {
    diagnostic.status = !origin ? 'origin_missing' : 'provider_missing';
    return { status: diagnostic.status };
  } else {
    let place = pointFromMemory || cached?.evidence.place;
    if (cached) diagnostic.cache = 'place_hit';
    const source = place?.source || 'openstreetmap';
    let webSourceUrl = place?.webSourceUrl || null;
    let status = 'not_found';
    if (!place && services.search) {
      const result = await observe(diagnostic, 'nominatim', () => services.search(args));
      status = result?.status;
      if (status === 'found') place = result.venue;
      if (!place && asCity && !cidade && status === 'not_found') {
        args.mode = 'venue';
        const named = await observe(diagnostic, 'nominatim', () => services.search(args));
        status = named?.status;
        if (status === 'found') place = named.venue;
      }
      if (!place && args.mode === 'venue' && status !== 'ambiguous' && services.webSearch) {
        const hint = await observe(diagnostic, 'openai_web_search', () => services.webSearch(args));
        if (hint?.status === 'found') {
          const mapped = await observe(diagnostic, 'nominatim', () => services.search({
            ...args, city: hint.venue.city, address: hint.venue.address,
          }));
          status = mapped?.status;
          if (status === 'found') {
            place = mapped.venue;
            webSourceUrl = hint.venue.sourceUrl;
          }
        }
      }
    }
    const verifiedPlace = point(place) && place.city && place.uf &&
      (!ufHint || ufHint === place.uf) && (source === 'owner' || /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/.test(place.sourceUrl || ''));
    const routing = verifiedPlace && place.uf === 'BA'
      ? await observe(diagnostic, services.provider, () => services.route({ origin, place })) : null;
    const validRoute = Number.isFinite(routing?.distanceKm) && routing.distanceKm >= 0 &&
      Number.isFinite(routing?.travelMinutes) && routing.travelMinutes >= 0;
    evidence = {
      status: verifiedPlace ? (place.uf !== 'BA' ? 'custom' : validRoute ? 'resolved' : 'route_unavailable') : status === 'ambiguous' ? 'ambiguous' : 'unverified',
      place: verifiedPlace ? { name: place.name, address: place.address, city: place.city, uf: place.uf,
        lat: Number(place.lat), lng: Number(place.lng), source, sourceUrl: place.sourceUrl || null, webSourceUrl } : null,
      routing: validRoute ? routing : null, checkedAt: new Date().toISOString(), precision: (cached?.evidence.precision || (args.mode === 'city' ? 'municipality' : args.mode)),
    };
  }

  const areaMatches = evidence.place ? matchingAreas(areas, evidence.place.city) : [];
  const classification = evidence.status === 'resolved'
    ? (areaMatches.length > 1 ? { status: 'review' } : classifyRoadLocation({
      ...evidence, area: gate.venue?.area_id ? areas.find((a) => a.id === gate.venue.area_id && a.active !== false) || areaMatches[0] : areaMatches[0],
      customLimit: Number(ctx.settings?.logistics_rules?.custom_over_minutes) || CUSTOM_TRIP_MINUTES,
    })) : { status: evidence.status };
  Object.assign(diagnostic, { status: classification.status, route: evidence.routing, precision: evidence.precision,
    source: evidence.place?.sourceUrl, webSource: evidence.place?.webSourceUrl, checkedAt: evidence.checkedAt,
    tier: classification.priceTier, metroSource: classification.metroSource });
  if (!cached || cached.status !== classification.status || cached.evidence.priceTier !== classification.priceTier) {
    const keepRoute = services.cacheRoutes || !evidence.routing;
    const storedEvidence = keepRoute ? evidence : { ...evidence, routing: null, status: 'geocoded' };
    if (!cached || keepRoute) {
      try {
        const { error } = await store.from(CACHE_TABLE).upsert({
          workspace_id: ctx.workspaceId, scope, lookup_key: key,
          evidence: { ...storedEvidence, priceTier: classification.priceTier, metro: classification.metro },
          status: classification.status,
          expires_at: new Date(Date.parse(evidence.checkedAt) + (evidence.status === 'resolved' ? TTL : REVIEW_TTL)).toISOString(),
        }, { onConflict: 'workspace_id,scope,lookup_key' });
        diagnostic.persisted = !error;
      } catch { diagnostic.persisted = false; }
    }
  }
  return { ...classification, place: evidence.place, routing: evidence.routing, precision: evidence.precision };
}
