import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupVenueOnline, VENUE_WEB_ATTRIBUTION } from '../lib/ai/commercial/venue-online.mjs';
import { resolveVenueWithOnlineLookup } from '../lib/ai/agent/location-gate.mjs';

const areas = [{ id: 'area-fake', name: 'Cidade Imaginária', active: true, price_tier: 'metro', status: 'served' }];
const fixture = (name, city) => ({
  name, display_name: name + ', ' + city + ', Bahia, Brasil',
  lat: '-12.7', lon: '-38.1', address: { city, state: 'Bahia' },
  osm_type: 'way', osm_id: 123456,
});
const mockFetch = (items) => async (_url, options) => {
  assert.match(_url, /nominatim.openstreetmap.org\/search/);
  assert.match(String(options.headers['User-Agent']), /Harmonics-Nara/);
  return { ok: true, json: async () => items };
};

test('busca online identifica somente nome E cidade; fornece atribuição OSM', async () => {
  const a = await lookupVenueOnline({
    venue: 'Chácara Caso Azul', city: 'Cidade Imaginária',
    fetchImpl: mockFetch([fixture('Chácara Caso Azul', 'Cidade Imaginária'),
      fixture('Chácara Caso Azul', 'Outra Cidade')]),
    now: () => 3000,
  });
  assert.equal(a.status, 'found');
  assert.equal(a.venue.uf, 'BA');
  assert.equal(a.venue.lat, -12.7);
  assert.equal(a.attribution, VENUE_WEB_ATTRIBUTION);
});
test('busca não aceita resultado de outra cidade ou nome distinto', async () => {
  const a = await lookupVenueOnline({
    venue: 'Sítio Caso Vermelho', city: 'Cidade Imaginária',
    fetchImpl: mockFetch([fixture('Sítio Caso Vermelho', 'Outra Cidade')]),
    now: () => 8000,
  });
  assert.equal(a.status, 'not_found');
});
test('duas ocorrências exatas exigem confirmação do cliente', async () => {
  const a = await lookupVenueOnline({
    venue: 'Espaço Caso Verde', city: 'Cidade Imaginária',
    fetchImpl: mockFetch([fixture('Espaço Caso Verde', 'Cidade Imaginária'),
      { ...fixture('Espaço Caso Verde', 'Cidade Imaginária'), osm_id: 555 }]),
    now: () => 13000,
  });
  assert.equal(a.status, 'ambiguous');
});
test('antes de pedir localização tenta pesquisar; achado exato permite classificador, sem inventar preço', async () => {
  let searches = 0;
  const r = await resolveVenueWithOnlineLookup({
    local: 'Chácara Caso Azul', cidade: 'Cidade Imaginária', areas, venues: [],
    searchFn: async ({ venue, city }) => {
      searches++;
      assert.equal(venue, 'Chácara Caso Azul');
      assert.equal(city, 'Cidade Imaginária');
      return { status: 'found', venue: { name: venue, address: 'Rua Imaginária, Cidade Imaginária', uf: 'BA', lat: -12.7, lng: -38.1, sourceUrl: 'https://www.openstreetmap.org/way/123' } };
    },
  });
  assert.equal(searches, 1);
  assert.equal(r.gate.action, 'proceed');
  assert.equal(r.verified.status, 'verified');
  assert.equal(r.verified.source, 'maps');
  assert.equal(r.gate.analysis.area.id, 'area-fake');
});
test('sem resultado, pergunta endereço depois da pesquisa; não inventa localização', async () => {
  const r = await resolveVenueWithOnlineLookup({
    local: 'Chácara Caso Inexistente', cidade: 'Cidade Imaginária', areas, venues: [],
    searchFn: async () => ({ status: 'not_found' }),
  });
  assert.equal(r.gate.action, 'ask');
  assert.match(r.gate.text, /Não consegui localizar.*pesquisa/i);
  assert.match(r.gate.text, /localização certinha/i);
  assert.equal(r.verified, null);
});
test('sem cidade não consulta web: pergunta só a cidade', async () => {
  const r = await resolveVenueWithOnlineLookup({
    local: 'Chácara Caso Sem Cidade', areas, venues: [],
    searchFn: async () => { throw new Error('não deveria pesquisar'); },
  });
  assert.equal(r.gate.reason, 'cidade_necessaria');
  assert.equal(r.lookup, null);
});
