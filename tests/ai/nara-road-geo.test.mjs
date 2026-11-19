import test from 'node:test';
import assert from 'node:assert/strict';
import { executeTool } from '../../lib/ai/agent/tools.mjs';
import { createRoadGeoServices } from '../../lib/ai/commercial/road-location.mjs';
import { createSimulationStore } from '../../lib/ai/commercial/simulation-store.mjs';

const future = '2031-08-12';
const name = 'Capela dos Pinheiros Azuis';
const city = 'Serra dos Pinheiros';
const rec = { name, category: 'amenity', type: 'place_of_worship', osm_type: 'node', osm_id: 42,
  display_name: `${name}, Rua das Nuvens, ${city}, Bahia`, lat: '-12.1', lon: '-37.9',
  address: { town: city, state: 'Bahia' } };

function fixture({ results = [rec], distance = 51000, seconds = 1900, fail = false, areas = [], town = city, webHint = false } = {}) {
  const rules = [
    ['ceremony', 'duo@metro', 611], ['ceremony', 'duo@ate120', 944],
    ['ceremony', 'trio@ate120', 1044], ['transport', 'standard_trip', 83], ['transport', 'sound_trip', 39],
  ].map(([category, item_key, amount]) => ({ workspace_id: 'ws-1', category, item_key, amount, valid_from: '2031-01-01' }));
  rules.push({ workspace_id: 'ws-1', category: 'ceremony', item_key: 'duo@ate120', amount: 1900, valid_from: '2032-01-01' });
  const local = createSimulationStore({ quote_price_rules: rules, ai_service_areas: areas });
  const rows = new Map();
  const geoSupabase = {
    from(table) {
      assert.equal(table, 'ai_geo_cache');
      const f = {};
      const key = () => JSON.stringify([f.workspace_id, f.scope, f.lookup_key]);
      const q = {
        select() { return q; },
        eq(k, v) { f[k] = v; return q; },
        gt(k, v) { f[k] = v; return q; },
        async maybeSingle() {
          const row = rows.get(key());
          return { data: row?.expires_at > f.expires_at ? structuredClone(row) : null };
        },
        async upsert(row) {
          rows.set(JSON.stringify([row.workspace_id, row.scope, row.lookup_key]), structuredClone(row));
          return { error: null };
        },
      };
      return q;
    },
  };
  const network = [];
  const env = { AI_NARA_ROAD_GEO_ENABLED: 'true', AI_NARA_NOMINATIM_URL: 'https://map.test',
    AI_NARA_OSRM_URL: 'https://route.test', AI_NARA_MAPS_REVISION: 'test-map-1' };
  if (webHint) Object.assign(env, { AI_VENUE_WEB_SEARCH_ENABLED: 'true', OPENAI_API_KEY: 'test-key' });
  const services = () => createRoadGeoServices({ env, fetchImpl: async (url, options) => {
    const u = new URL(url);
    network.push(u.hostname);
    if (u.hostname === 'api.openai.com') {
      assert.equal(JSON.parse(options.body).max_tool_calls, 1);
      const source = 'https://parish.example.test/address';
      return Response.json({ output: [
        { type: 'web_search_call', action: { type: 'search' } },
        { type: 'message', content: [{ type: 'output_text',
          annotations: [{ type: 'url_citation', url: source }],
          text: JSON.stringify({ status: 'found', name, city, address: rec.display_name, source_url: source }) }] },
      ] });
    }
    if (u.hostname === 'map.test') {
      return Response.json(webHint && !u.searchParams.get('q').includes('Rua das Nuvens') ? [] : results);
    }
    assert.match(u.pathname, /^\/route\/v1\/driving\//);
    return fail ? new Response(null, { status: 503 }) : Response.json({
      code: 'Ok', waypoints: [{ distance: 7 }, { distance: 6 }], routes: [{ distance, duration: seconds }],
    });
  } });
  const run = async ({ place = name, asSound = false, origin = '-12.9,-38.5', workspaceId = 'ws-1', simulated = true } = {}) => {
    const effects = {};
    const ctx = { supabase: local, geoSupabase, workspaceId, effects, simulated, roadGeo: services(),
      settings: { logistics_rules: { origin, per_km_rate: 50 } },
      conversation: { id: 'simulation', lead_data: { cidade: town, local: place, tipo_evento: 'casamento', data_evento: future } } };
    const quote = await executeTool('consultar_precos', { com_som: asSound }, ctx);
    return { quote, effects };
  };
  return { run, rows, network, rules, env, local };
}

test('cidade fora da memória recebe tabela vigente sem horário e com um deslocamento aprovado', async () => {
  const f = fixture();
  const { quote, effects } = await f.run();
  assert.equal(quote.ok, true);
  assert.equal(quote.tabela[0].valor_cerimonia, 944);
  assert.equal(quote.deslocamento, 83);
  assert.match(effects.quoteTableText, /R\$ 83/);
  assert.equal(effects.roadGeo.tier, 'ate120');
  assert.deepEqual(f.network, ['map.test', 'route.test']);
});

test('nova requisição reutiliza evidência completa e relê vigência do preço', async () => {
  const f = fixture();
  await f.run();
  f.local.tables.quote_price_rules[1].amount = 994;
  const repeated = await f.run();
  assert.equal(repeated.effects.roadGeo.cache, 'hit');
  assert.equal(repeated.effects.roadGeo.calls.length, 0);
  assert.equal(repeated.quote.tabela[0].valor_cerimonia, 994);
  assert.deepEqual(f.network, ['map.test', 'route.test']);
});

test('origem, revisão do mapa, workspace e escopo invalidam a chave da rota', async () => {
  const f = fixture();
  await f.run();
  assert.equal((await f.run({ origin: '-12.8,-38.5' })).effects.roadGeo.cache, 'miss');
  f.env.AI_NARA_MAPS_REVISION = 'test-map-2';
  assert.equal((await f.run()).effects.roadGeo.cache, 'miss');
  assert.equal((await f.run({ workspaceId: 'ws-2' })).quote.ok, false);
  assert.equal((await f.run({ simulated: false })).effects.roadGeo.cache, 'miss');
  assert.equal(f.rows.size, 4);
});

test('homônimos não chegam ao roteador nem recebem preço', async () => {
  const f = fixture({ results: [rec, { ...rec, osm_id: 43, lat: '-12.2' }] });
  const { quote, effects } = await f.run();
  assert.equal(quote.ok, false);
  assert.equal(effects.roadGeo.status, 'ambiguous');
  assert.ok(f.network.every((host) => host === 'map.test'));
});

test('a faixa até 120 km precede uma área cadastrada como metro', async () => {
  const f = fixture({ distance: 120000, areas: [{ workspace_id: 'ws-1', name: city, status: 'served', price_tier: 'metro' }] });
  const { quote, effects } = await f.run();
  assert.equal(effects.roadGeo.tier, 'ate120');
  assert.equal(quote.tabela[0].valor_cerimonia, 944);
});

test('acima de 120 km ou 150 minutos vira orçamento personalizado', async () => {
  for (const config of [{ distance: 120001 }, { seconds: 9001 }]) {
    const { quote, effects } = await fixture(config).run();
    assert.equal(quote.erro, 'orcamento_personalizado');
    assert.equal(effects.roadGeo.status, 'custom');
    assert.equal(effects.quoteTableText, undefined);
  }
});

test('falha do roteador fica pendente e não substitui por distância em linha reta', async () => {
  const { quote, effects } = await fixture({ fail: true }).run();
  assert.equal(quote.ok, false);
  assert.equal(effects.roadGeo.status, 'route_unavailable');
  assert.equal(effects.roadGeo.route, null);
});

test('o transporte de som só aparece quando pedido e soma uma única taxa própria', async () => {
  const { quote, effects } = await fixture().run({ asSound: true });
  assert.equal(quote.deslocamento, 83);
  assert.equal((effects.quoteText.match(/R\$ 83/g) || []).length, 1);
  assert.equal((effects.quoteText.match(/R\$ 39/g) || []).length, 1);
});

test('somente a cidade pode geocodificar o município e liberar estimativa inicial', async () => {
  const municipality = { ...rec, name: city, type: 'municipality', addresstype: 'municipality', category: 'boundary' };
  const { quote, effects } = await fixture({ results: [municipality] }).run({ place: city });
  assert.equal(quote.ok, true);
  assert.equal(effects.roadGeo.precision, 'municipality');
  assert.equal(effects.venueAddressPending, true);
});

test('pesquisa citada fica pendente sem confirmação independente no mapa', async () => {
  const f = fixture({ results: [], webHint: true });
  const { quote, effects } = await f.run();
  assert.equal(quote.ok, false);
  assert.equal(effects.roadGeo.status, 'unverified');
  assert.deepEqual(f.network, ['map.test', 'api.openai.com', 'map.test']);
  assert.equal(effects.roadGeo.webSearchFeeUsd, 0.01);
});
