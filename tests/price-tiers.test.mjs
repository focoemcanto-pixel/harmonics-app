// Faixas regionais sobre a tabela oficial (dados sintéticos).
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTierSlug, tierLabel, parseTieredKey, tieredKey, listTiers, buildTierGrid, itemLabel, gridItems } from '../lib/quotes/tiers.mjs';

test('identificadores e rótulos de faixa', () => {
  assert.equal(normalizeTierSlug('Litoral Norte'), 'litoral-norte');
  assert.equal(normalizeTierSlug('  Região-base '), 'base');
  assert.equal(normalizeTierSlug('x'), null);
  assert.equal(tierLabel('metro'), 'Metropolitana');
  assert.equal(tierLabel('ate120'), 'Até 120 km');
  assert.equal(tierLabel('litoral-norte'), 'Litoral Norte');
  assert.deepEqual(parseTieredKey('trio@metro'), { key: 'trio', tier: 'metro' });
  assert.deepEqual(parseTieredKey('trio'), { key: 'trio', tier: 'base' });
  assert.equal(tieredKey('trio_2h', 'ate120'), 'trio_2h@ate120');
  assert.equal(tieredKey('trio', 'base'), 'trio');
  assert.equal(itemLabel('reception', 'trio_2h', 'metro'), 'Receptivo Trio 2h — Metropolitana');
  assert.equal(gridItems('reception').length, 15);
});

test('faixas conhecidas: padrão + com preço + usadas por localidades', () => {
  const tiers = listTiers({ rules: [{ item_key: 'duo@serra' }], areas: [{ price_tier: 'litoral' }, { price_tier: 'custom' }, { price_tier: null }] });
  assert.deepEqual(tiers.map((t) => t.slug), ['base', 'metro', 'ate120', 'serra', 'litoral']);
});

test('grade formação × faixa só com regras existentes (sem inventar valores)', () => {
  const rules = [
    { id: 1, category: 'ceremony', item_key: 'trio', amount: 1000, valid_from: '2090-01-01', valid_until: '2090-12-31' },
    { id: 2, category: 'ceremony', item_key: 'trio', amount: 1100, valid_from: '2091-01-01' },
    { id: 3, category: 'ceremony', item_key: 'trio@metro', amount: 1300, valid_from: '2090-01-01' },
  ];
  const grid = buildTierGrid({ rules, category: 'ceremony', tiers: ['base', 'metro', 'ate120'], refDate: '2090-06-01' });
  const trio = grid.find((r) => r.key === 'trio');
  assert.equal(trio.cells[0].current.amount, 1000);
  assert.deepEqual(trio.cells[0].future.map((f) => f.amount), [1100]);
  assert.equal(trio.cells[1].current.amount, 1300);
  assert.equal(trio.cells[2].current, null, 'faixa sem preço fica vazia');
  assert.equal(trio.cells[2].itemKey, 'trio@ate120');
  assert.equal(grid.find((r) => r.key === 'duo').cells[0].current, null);
});

test('localidade herda preços da faixa, deslocamento efetivo com origem e pendências (motor da Nara)', async () => {
  const { previewArea } = await import('../lib/ai/commercial/area-preview.mjs');
  const rules = [
    { category: 'ceremony', item_key: 'duo', amount: 1000, valid_from: '2090-01-01' },
    { category: 'ceremony', item_key: 'trio', amount: 1500, valid_from: '2090-01-01' },
    { category: 'ceremony', item_key: 'duo@metro', amount: 1200, valid_from: '2090-01-01' },
    { category: 'ceremony', item_key: 'trio@metro', amount: 1700, valid_from: '2090-01-01' },
    { category: 'transport', item_key: 'standard_trip', amount: 150, valid_from: '2090-01-01' },
  ];
  const d = '2090-06-01';
  const base = previewArea({ area: { name: 'Cidade Base', match_terms: ['cidade base'], status: 'served', active: true }, rules, date: d });
  assert.deepEqual(base.prices.slice(0, 2).map((p) => p.amount), [1000, 1500]);
  assert.equal(base.travel.amount, 0);
  assert.ok(base.issues.some((i) => i.code === 'tier_partial'), 'quarteto/quinteto/sexteto sem preço sintético');

  const metroOwn = previewArea({ area: { name: 'Cidade Metro', match_terms: ['cidade metro'], status: 'served', active: true, price_tier: 'metro', travel_fee: 180 }, rules, date: d });
  assert.equal(metroOwn.tier_label, 'Metropolitana');
  assert.deepEqual(metroOwn.prices.slice(0, 2).map((p) => p.amount), [1200, 1700], 'herda a faixa, não a base');
  assert.deepEqual([metroOwn.travel.amount, metroOwn.travel.source], [180, 'area']);

  const metroRule = previewArea({ area: { name: 'Outra Metro', match_terms: ['outra metro'], status: 'served', active: true, price_tier: 'metro' }, rules, date: d });
  assert.deepEqual([metroRule.travel.amount, metroRule.travel.source], [150, 'rule'], 'sem taxa própria: regra padrão, uma única vez');

  const empty = previewArea({ area: { name: 'Cidade Longe', match_terms: ['cidade longe'], status: 'served', active: false, price_tier: 'ate120' }, rules: rules.filter((r) => r.category !== 'transport'), date: d });
  assert.ok(empty.prices.every((p) => p.amount == null), 'nunca cai na base');
  const codes = empty.issues.map((i) => i.code);
  assert.ok(codes.includes('inactive') && codes.includes('tier_without_prices') && codes.includes('outside_base_without_travel'));
});

test('faixa da localidade aceita personalizadas e normaliza o nome', async () => {
  const { parseServiceAreaInput } = await import('../lib/ai/commercial/admin-input.mjs');
  assert.equal(parseServiceAreaInput({ name: 'A', price_tier: 'Litoral Norte' }).price_tier, 'litoral-norte');
  assert.equal(parseServiceAreaInput({ name: 'A', price_tier: 'metro' }).price_tier, 'metro');
  assert.equal(parseServiceAreaInput({ name: 'A', price_tier: '' }).price_tier, null);
  assert.equal(parseServiceAreaInput({ name: 'A', price_tier: 'base' }).price_tier, null);
});
