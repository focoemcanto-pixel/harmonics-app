import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupVenueWeb, parseVenueSearchResponse } from '../lib/ai/commercial/venue-web-search.mjs';
import { resolveVenueWithOnlineLookup } from '../lib/ai/agent/location-gate.mjs';

const venue = 'Espaço Aliança', city = 'Salvador';
const sourceUrl = 'https://example.org/espaco-alianca';
const response = (json, citations = [sourceUrl]) => ({
  output: [
    { type: 'web_search_call', id: 's_1' },
    { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(json),
      annotations: citations.map((url) => ({ type: 'url_citation', url })) }] },
  ],
});
const found = { status: 'found', name: venue, city, address: 'Rua Exemplo, 14, Salvador, Bahia', source_url: sourceUrl };

test('pesquisa web aceita espaço+cidade exatos com endereço e fonte citada', () => {
  const r = parseVenueSearchResponse(response(found), { venue, city });
  assert.equal(r.status, 'found');
  assert.equal(r.venue.sourceUrl, sourceUrl);
  assert.equal(r.venue.address, found.address);
});

test('pesquisa web bloqueia nome, cidade e URL divergentes', () => {
  assert.equal(parseVenueSearchResponse(response({ ...found, name: 'Espaço Outro' }), { venue, city }).status, 'ambiguous');
  assert.equal(parseVenueSearchResponse(response({ ...found, city: 'Recife' }), { venue, city }).status, 'ambiguous');
  assert.equal(parseVenueSearchResponse(response({ ...found, source_url: 'https://example.org/inventado' }), { venue, city }).status, 'unavailable');
  assert.equal(parseVenueSearchResponse({ output: [{ type: 'message', content: [{ text: JSON.stringify(found) }] }] }, { venue, city }).status, 'unavailable');
});

test('web_search é chamada uma única vez quando OSM falha', async () => {
  let calls = 0;
  const r = await lookupVenueWeb({ venue, city, env: { OPENAI_API_KEY: 'fake-test-key' }, now: () => 30000,
    fetchImpl: async (_url, options) => {
      calls++;
      const payload = JSON.parse(options.body);
      assert.equal(payload.tools[0].type, 'web_search');
      assert.equal(payload.store, false);
      return { ok: true, json: async () => response(found) };
    } });
  assert.equal(calls, 1);
  assert.equal(r.status, 'found');
});

test('pipeline consulta OSM e depois web somente se necessário', async () => {
  const areas = [{ name: 'Salvador', active: true, status: 'served' }];
  let webCalls = 0;
  const r = await resolveVenueWithOnlineLookup({
    local: venue, cidade: city, areas,
    searchFn: async () => ({ status: 'not_found' }),
    webSearchFn: async () => {
      webCalls++;
      return { status: 'found', venue: { name: venue, city, address: found.address, uf: 'BA', sourceUrl }, attribution: 'Pesquisa web (OpenAI)' };
    },
  });
  assert.equal(webCalls, 1);
  assert.equal(r.gate.action, 'proceed');
  assert.equal(r.verified.name, venue);
  assert.match(r.verified.notes, /Pesquisa web/);
});

test('web fallback nunca roda se OSM já encontrou o espaço', async () => {
  let called = false;
  const r = await resolveVenueWithOnlineLookup({
    local: venue, cidade: city, areas: [{ name: 'Salvador', active: true, status: 'served' }],
    searchFn: async () => ({ status: 'found', venue: { name: venue, address: found.address, uf: 'BA' }, attribution: 'OpenStreetMap' }),
    webSearchFn: async () => { called = true; throw new Error('not expected'); },
  });
  assert.equal(called, false);
  assert.equal(r.gate.action, 'proceed');
});
