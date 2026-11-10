// Memória permanente de espaços — dados 100% sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { findVenue, venueKey, splitVenueText, venueReport, parseVenueInput, venueLocation } from '../lib/ai/commercial/venues.mjs';
import { locationGate } from '../lib/ai/commercial/geo.mjs';

const AREAS = [
  { id: 'a1', name: 'Cidade Base Teste', status: 'served', active: true },
  { id: 'a2', name: 'Vila Vizinha Teste', status: 'served', active: true, price_tier: 'faixa-x', travel_fee: 111 },
];
const V = (o) => ({ status: 'verified', uf: 'BA', aliases: [], verified_at: '2090-01-01T00:00:00Z', ...o, name_norm: venueKey(o.name), city_norm: venueKey(o.city) });
const VENUES = [
  V({ id: 'v1', name: 'Chácara Recanto Inventado', city: 'Vila Vizinha Teste', area_id: 'a2', aliases: ['Recanto Inventado'] }),
  V({ id: 'v2', name: 'Espaço Duplicado Teste', city: 'Cidade Base Teste' }),
  V({ id: 'v3', name: 'Espaço Duplicado Teste', city: 'Vila Vizinha Teste' }),
  V({ id: 'v4', name: 'Sítio Longe Teste', city: 'Cidade Fora Teste', uf: 'PE' }),
  { ...V({ id: 'v5', name: 'Salão Só Relatado', city: 'Cidade Base Teste' }), status: 'client_reported', verified_at: null },
];

test('venueKey/splitVenueText normalizam sem perder a cidade', () => {
  assert.equal(venueKey('na Chácara Recanto Inventado'), 'chacara recanto inventado');
  assert.deepEqual(splitVenueText('Espaço X, Cidade Y - SE'), { venue: 'Espaço X', city: 'Cidade Y', uf: 'SE' });
  assert.deepEqual(splitVenueText('Espaço X', 'Cidade Base Teste'), { venue: 'Espaço X', city: 'Cidade Base Teste', uf: null });
});

test('espaço verificado é reutilizado (nome ou apelido), sem perguntar de novo', () => {
  const g = locationGate({ local: 'na Chácara Recanto Inventado', areas: AREAS, venues: VENUES });
  assert.equal(g.action, 'proceed');
  assert.equal(g.venue.id, 'v1');
  assert.equal(g.analysis.area.id, 'a2', 'classifica pela localidade vinculada');
  assert.equal(locationGate({ local: 'Recanto Inventado', areas: AREAS, venues: VENUES }).venue?.id, 'v1');
});

test('homônimos: sem cidade pergunta; com cidade escolhe o certo; cidade diferente = outro lugar', () => {
  const ask = locationGate({ local: 'Espaço Duplicado Teste', areas: AREAS, venues: VENUES });
  assert.equal(ask.action, 'ask');
  assert.match(ask.text, /Em qual cidade fica o Espaço Duplicado Teste\?/);
  assert.equal(findVenue(VENUES, { local: 'Espaço Duplicado Teste', cidade: 'Vila Vizinha Teste' }).venue.id, 'v3');
  assert.equal(findVenue(VENUES, { local: 'Espaço Duplicado Teste, Cidade Base Teste' }).venue.id, 'v2');
  assert.equal(findVenue(VENUES, { local: 'Chácara Recanto Inventado', cidade: 'Cidade Sem Cadastro' }).kind, 'none');
});

test('espaço verificado em outro estado => orçamento personalizado', () => {
  const g = locationGate({ local: 'Sítio Longe Teste', areas: AREAS, venues: VENUES });
  assert.equal(g.action, 'custom');
  assert.equal(g.reason, 'other_state_custom');
  assert.equal(venueLocation(VENUES[3], AREAS), 'Sítio Longe Teste, Cidade Fora Teste - PE');
});

test('relato de cliente não classifica sozinho (aguarda conferência do Owner)', () => {
  assert.equal(findVenue(VENUES, { local: 'Salão Só Relatado' }).kind, 'none');
  assert.equal(locationGate({ local: 'Salão Só Relatado', areas: AREAS, venues: VENUES }).action, 'ask');
});

test('venueReport: grava espaço + cidade informados pela cliente; nada sem cidade ou sem nome de espaço', () => {
  const r = venueReport({ local: 'Chácara Nova Teste', cidade: 'Cidade Base Teste', analysis: { kind: 'area', area: AREAS[0] }, conversationId: 'c1' });
  assert.equal(r.status, 'client_reported');
  assert.equal(r.source, 'client_message');
  assert.equal(r.uf, 'BA');
  assert.equal(r.area_id, 'a1');
  assert.equal(venueReport({ local: 'Chácara Nova Teste', analysis: { kind: 'unregistered' } }), null, 'sem cidade');
  assert.equal(venueReport({ local: 'Cidade Base Teste', analysis: { kind: 'area', area: AREAS[0] } }), null, 'só cidade');
  assert.equal(venueReport({ local: 'Espaço Fora Teste, Recife', analysis: { kind: 'other_state' } }).uf, 'PE');
});

test('parseVenueInput: verificação do Owner grava fonte e data; valida UF e coordenadas', () => {
  const now = '2090-02-02T10:00:00.000Z';
  const ok = parseVenueInput({ name: 'Espaço Teste', city: 'Cidade Base Teste', aliases: 'Apelido A, Apelido A, Apelido B', lat: '-12,5', lng: '-38.4' }, { actor: 'u1', now });
  assert.deepEqual(ok.aliases, ['Apelido A', 'Apelido B']);
  assert.equal(ok.verified_at, now);
  assert.equal(ok.verified_by, 'u1');
  assert.equal(ok.source, 'owner');
  assert.equal(ok.lat, -12.5);
  assert.match(parseVenueInput({ name: 'X', city: 'Y', uf: 'Bahia' }).error, /UF/);
  assert.match(parseVenueInput({ name: 'X', city: 'Y', lat: 100, lng: 0 }).error, /Coordenadas/);
  assert.match(parseVenueInput({ name: 'X', city: 'Y', lat: 1 }).error, /Coordenadas/);
  assert.match(parseVenueInput({ name: 'X' }).error, /cidade/);
});
