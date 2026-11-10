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
