import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContractTemplateData } from '../lib/contracts/buildContractTemplateData.js';
import { renderContractHtmlWithTemplateData } from '../lib/contracts/resolveContractHtmlSource.js';
import { parseContractTemplateInput } from '../lib/contracts/templateImport.js';

function makeData(overrides = {}) {
  return buildContractTemplateData({
    precontract: {
      formation: 'Trio',
      instruments: 'Voz, Violino, Teclado',
      event_date: '2027-05-02',
      agreed_amount: 3050,
      ...overrides,
    },
  });
}

test('cerimônia sem receptivo não inclui alimentação nem inventa serviços opcionais', () => {
  const data = makeData();
  assert.equal(data.RECEPTIVO, false);
  assert.equal(data.ALIMENTACAO_RECEPTIVO_2H, false);
  assert.equal(data.SOM_NAO_DEFINIDO, true);
  assert.equal(data.TRANSPORTE_NAO_DEFINIDO, true);
});

test('receptivo legado de 2h exige refeição, 119 minutos não; flags de som são independentes', () => {
  const two = makeData({ reception_hours: 2, has_sound: true, has_transport: false });
  const less = makeData({ reception_hours: 119 / 60, has_sound: false, has_transport: true });
  assert.equal(two.RECEPTIVO, true);
  assert.equal(two.ALIMENTACAO_RECEPTIVO_2H, true);
  assert.equal(two.RECEPTIVO_DURACAO_PENDENTE, false);
  assert.equal(two.SOM_INCLUSO, true);
  assert.equal(two.TRANSPORTE_NAO_INCLUSO, true);
  assert.equal(less.ALIMENTACAO_RECEPTIVO_2H, false);
  assert.equal(less.SOM_NAO_INCLUSO, true);
  assert.equal(less.TRANSPORTE_INCLUSO, true);
});

test('serviços estruturados respeitam 119 e 120 minutos sem arredondar horas', () => {
  const ceremony = { id: 'c', kind: 'primary', label: 'Cerimônia', formation: 'Trio',
    roles: ['Voz', 'Violino', 'Teclado'], duration_minutes: 60 };
  const reception = { id: 'r', kind: 'reception', label: 'Receptivo', formation: 'Quarteto',
    roles: ['Voz', 'Violino', 'Cajón', 'Violão'], duration_minutes: 119 };
  const less = makeData({ service_specs: [ceremony, reception] });
  const two = makeData({ service_specs: [ceremony, { ...reception, duration_minutes: 120 }] });
  assert.equal(less.ALIMENTACAO_RECEPTIVO_2H, false);
  assert.equal(less.RECEPTIVO_DURACAO, '119 minutos');
  assert.equal(two.ALIMENTACAO_RECEPTIVO_2H, true);
  assert.equal(two.RECEPTIVO_DURACAO, '2h');
  assert.match(two.services_text, /Receptivo: Quarteto · Voz, Violino, Cajón, Violão · 2h/);
  assert.equal(two.RECEPTIVO_DURACAO_PENDENTE, false);
});

test('duração ausente pode ser detectada antes da assinatura', () => {
  const data = makeData({ service_specs: [
    { id: 'r', kind: 'reception', label: 'Receptivo', roles: ['Voz'], duration_minutes: null },
  ] });
  assert.equal(data.RECEPTIVO, true);
  assert.equal(data.RECEPTIVO_DURACAO_PENDENTE, true);
  assert.equal(data.ALIMENTACAO_RECEPTIVO_2H, false);
});

test('valor da hora extra e parcelas são proporcionais e variam por evento', () => {
  const standard = makeData();
  assert.match(standard.ATRASO_VALOR_HORA, /305,00/);
  assert.match(standard.VALOR_SINAL, /1\.525,00/);
  assert.match(standard.VALOR_SALDO, /1\.525,00/);
  const odd = makeData({ agreed_amount: 3050.01 });
  const extract = (v) => Number(v.replace(/[^\d,]/g, '').replace(',', '.'));
  assert.equal(Math.round((extract(odd.VALOR_SINAL) + extract(odd.VALOR_SALDO)) * 100), 305001);
});

test('condicionais inclusive aninhadas não deixam chaves soltas e ocultam o que não foi contratado', () => {
  const data = makeData({ reception_hours: 2, has_sound: false });
  const source = '<p>{{#RECEPTIVO}}Receptivo {{#ALIMENTACAO_RECEPTIVO_2H}}com refeição{{/ALIMENTACAO_RECEPTIVO_2H}}{{/RECEPTIVO}}</p>' +
    '<p>{{#SOM_INCLUSO}}Som incluído{{/SOM_INCLUSO}}</p>' +
    '<p>{{#SOM_NAO_INCLUSO}}Som fora da proposta{{/SOM_NAO_INCLUSO}}</p>';
  const html = renderContractHtmlWithTemplateData(source, data);
  assert.match(html, /Receptivo com refeição/);
  assert.match(html, /Som fora da proposta/);
  assert.doesNotMatch(html, /Som incluído|\{\{|\}\}/);
  const noReception = renderContractHtmlWithTemplateData(source, makeData({ has_sound: true }));
  assert.doesNotMatch(noReception, /Receptivo com refeição|Som fora da proposta/);
  assert.match(noReception, /Som incluído/);
});

test('importador reconhece novas tags sem tratá-las como placeholders desconhecidos', () => {
  const parsed = parseContractTemplateInput(
    '{{#ALIMENTACAO_RECEPTIVO_2H}}Equipe: {{RECEPTIVO_DURACAO}}{{/ALIMENTACAO_RECEPTIVO_2H}} Valor adicional {{ATRASO_VALOR_HORA}}'
  );
  assert.deepEqual(parsed.unknownPlaceholders, []);
  assert.ok(parsed.conditionals.includes('ALIMENTACAO_RECEPTIVO_2H'));
  assert.ok(parsed.detectedPlaceholders.includes('reception_duration'));
});
