import test from 'node:test';
import assert from 'node:assert/strict';
import { extractLocationEvidence, verifyLocationEvidence } from '../lib/ai/commercial/venue-location-evidence.mjs';

test('identifica CEP enviado para resolver espaço não encontrado', () => {
  assert.deepEqual(extractLocationEvidence('O CEP é 44001-020'), { type: 'cep', value: '44001020' });
  assert.equal(extractLocationEvidence('Fica em Feira de Santana'), null);
});
test('valida CEP e obtém cidade/UF da fonte pública, sem inferir pelo nome do espaço', async () => {
  const r = await verifyLocationEvidence({ type: 'cep', value: '44001020' }, { fetchImpl: async (url) => {
    assert.match(url, /viacep\.com\.br\/ws\/44001020\/json/);
    return { ok: true, json: async () => ({ cep: '44001-020', localidade: 'Feira de Santana', uf: 'BA', bairro: 'Centro', logradouro: 'Rua Teste' }) };
  } });
  assert.equal(r.status, 'confirmed');
  assert.equal(r.city, 'Feira de Santana');
  assert.equal(r.uf, 'BA');
  assert.equal(r.precision, 'cep');
});
test('CEP inexistente ou consulta indisponível não confirma localidade', async () => {
  const r = await verifyLocationEvidence({ type: 'cep', value: '99999999' }, { fetchImpl: async () => ({ ok: true, json: async () => ({ erro: true }) }) });
  assert.equal(r.status, 'not_found');
});
test('aceita coordenadas enviadas em link Google Maps, mas consulta somente endpoint fixo OSM', async () => {
  const evidence = extractLocationEvidence('https://www.google.com/maps/@-12.260000,-38.970000,16z');
  assert.equal(evidence.type, 'coordinates');
  let calls = 0;
  const r = await verifyLocationEvidence(evidence, { fetchImpl: async (url) => {
    calls++;
    assert.match(url, /^https:\/\/nominatim\.openstreetmap\.org\/reverse\?/);
    return { ok: true, json: async () => ({ display_name: 'Praça Exemplo, Feira de Santana, Bahia, Brasil', address: { city: 'Feira de Santana', state: 'Bahia', country_code: 'br' } }) };
  } });
  assert.equal(calls, 1);
  assert.equal(r.city, 'Feira de Santana');
  assert.equal(r.precision, 'coordinates');
});
test('endereço ambíguo sem identificação de cidade não deve liberar orçamento', async () => {
  const evidence = extractLocationEvidence('Rua Teste, 40');
  assert.equal(evidence.type, 'address');
  const r = await verifyLocationEvidence(evidence, { fetchImpl: async () => ({ ok: true, json: async () => [] }) });
  assert.equal(r.status, 'not_found');
});
