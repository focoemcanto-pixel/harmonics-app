// Busca complementar de espaços com OpenAI Responses web_search.
// Opt-in: chamadas de web_search geram cobrança separada. Nunca inferir distância ou preço pela busca.
const cache = new Map();
const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function parseVenueSearchResponse(payload, { venue, city }) {
  const output = Array.isArray(payload?.output) ? payload.output : [];
  if (!output.some((item) => item?.type === 'web_search_call')) return { status: 'unavailable', reason: 'no_search_call' };
  const content = output.filter((x) => x.type === 'message').flatMap((x) => x.content || []);
  const citations = content.flatMap((x) => x.annotations || [])
    .filter((a) => a.type === 'url_citation' && /^https:\/\//.test(a.url || ''));
  if (!citations.length) return { status: 'unavailable', reason: 'no_citations' };
  let item;
  try {
    const raw = content.map((x) => x.text || '').join('\n').trim();
    item = JSON.parse(raw);
  } catch { return { status: 'unavailable', reason: 'invalid_json' }; }
  if (item?.status !== 'found') return { status: 'not_found', attribution: 'Pesquisa web (OpenAI)' };
  if (norm(item.name) !== norm(venue) || norm(item.city) !== norm(city)) {
    return { status: 'ambiguous', reason: 'name_city_mismatch' };
  }
  const address = String(item.address || '').trim();
  if (address.length < 8 || address.length > 240 || !norm(address).includes(norm(city))) {
    return { status: 'ambiguous', reason: 'address_not_confirmed' };
  }
  const url = String(item.source_url || '');
  if (!citations.some((a) => a.url === url)) return { status: 'unavailable', reason: 'uncited_source' };
  return { status: 'found',
    venue: { name: item.name, city: item.city, address, uf: 'BA', source: 'web', sourceUrl: url },
    attribution: 'Pesquisa web (OpenAI)' };
}

export async function lookupVenueWeb({ venue, city, env = process.env, fetchImpl = fetch, now = () => Date.now() } = {}) {
  const key = norm(venue) + '|' + norm(city);
  const instant = now();
  const hit = cache.get(key);
  if (hit && hit.expires > instant) return { ...hit.result, cached: true };
  if (!env.OPENAI_API_KEY) return { status: 'unavailable', reason: 'no_api_key' };
  if (!venue || !city || venue.length > 120 || city.length > 80) return { status: 'unavailable', reason: 'invalid_query' };
  try {
    const r = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.OPENAI_API_KEY },
      body: JSON.stringify({
        model: env.AI_VENUE_SEARCH_MODEL || 'gpt-4.1-mini', store: false,
        max_output_tokens: 420, tool_choice: 'required',
        tools: [{ type: 'web_search', search_context_size: 'low' }],
        instructions: [
          'Pesquise um espaço de eventos do Brasil usando a ferramenta web_search.',
          'Responda apenas JSON válido: {"status":"found","name":"","city":"","address":"","source_url":""}, ou {"status":"not_found"}.',
          'Só use found quando nome e cidade corresponderem EXATAMENTE ao solicitado.',
          'O endereço precisa conter a cidade. source_url deve ser a URL da fonte real consultada.',
          'Sem fonte que comprove o endereço, devolva not_found. Nunca invente dados ou URLs.',
        ].join(' '),
        input: 'Identifique o endereço de "' + venue + '" em "' + city + ', Bahia, Brasil".',
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return { status: 'unavailable', reason: 'openai_http_' + r.status };
    const result = parseVenueSearchResponse(await r.json(), { venue, city });
    if (cache.size > 300) cache.clear();
    cache.set(key, { result, expires: instant + (result.status === 'found' ? 86400000 : 1800000) });
    return result;
  } catch { return { status: 'unavailable', reason: 'network_error' }; }
}
