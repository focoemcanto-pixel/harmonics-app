// Preços oficiais por data (Eventos e painel do cliente) e planejamento de vigência — dados 100% sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEventPrices, receptionOffer, pickOfficial, formationKey } from '../lib/quotes/official-prices.mjs';
import { planRuleChange, shiftDay } from '../lib/quotes/rule-change.mjs';

const RULES = [
  { category: 'ceremony', item_key: 'trio', amount: 1110, valid_from: '2080-01-01', valid_until: '2081-05-31' },
  { category: 'ceremony', item_key: 'trio', amount: 1330, valid_from: '2081-06-01', valid_until: null },
  { category: 'reception', item_key: 'quarteto_3h', amount: 1210, valid_from: '2080-01-01', valid_until: null },
  { category: 'sound', item_key: 'church', amount: 640, valid_from: '2080-01-01', valid_until: null },
  { category: 'sound', item_key: 'church_reception_1h', amount: 720, valid_from: '2080-01-01', valid_until: null },
];

test('formação normalizada e regra vigente na data', () => {
  assert.deepEqual(['Quarteto', 'SEXTETO', 'septeto', 'Solo', 'x'].map(formationKey), ['quarteto', 'sexteto', 'septeto', 'solo', '']);
  assert.equal(pickOfficial(RULES, 'ceremony', 'trio', '2081-05-31'), 1110);
  assert.equal(pickOfficial(RULES, 'ceremony', 'trio', '2081-06-01'), 1330);
});

test('Eventos: oficial pela data do evento; reserva só sem regra oficial', () => {
  const fb = { ceremony: 999, reception: 888, sound: 77 };
  const a = resolveEventPrices({ rules: RULES, date: '2081-07-01', formation: 'Trio', receptionHours: 1, hasSound: true, fallback: fb });
  assert.deepEqual([a.ceremony, a.reception, a.sound], [1330, 888, 720]);
  assert.deepEqual(a.sources, { ceremony: 'official', reception: 'fallback', sound: 'official' });
  const solo = resolveEventPrices({ rules: RULES, date: '2081-07-01', formation: 'Solo', fallback: { ceremony: 555 } });
  assert.equal(solo.ceremony, 555, 'Solo sem regra oficial continua na tabela do Eventos');
  const long = resolveEventPrices({ rules: RULES, date: '2081-07-01', formation: 'Trio', receptionHours: 3, hasSound: true, fallback: fb });
  assert.equal(long.soundRequiresValidation, true);
  assert.equal(long.sound, 0);
  const none = resolveEventPrices({ rules: [], date: '2081-07-01', formation: 'Trio', hasSound: true, fallback: fb });
  assert.deepEqual([none.ceremony, none.sound], [999, 77], 'sem regras oficiais: comportamento anterior');
});

test('painel do cliente: oferta de receptivo usa a regra oficial e completa com a reserva', () => {
  const offer = receptionOffer({ rules: RULES, date: '2081-07-01', formation: 'quarteto', fallback: { 1: 410, 2: 520, 3: 2990 } });
  assert.deepEqual(offer, { 1: 410, 2: 520, 3: 1210 });
});

test('vigência: encerra a regra atual na véspera e respeita regra futura', () => {
  const existing = [
    { id: 'a', category: 'sound', item_key: 'church', amount: 640, valid_from: '2080-01-01', valid_until: null },
    { id: 'b', category: 'sound', item_key: 'church', amount: 700, valid_from: '2082-01-01', valid_until: null },
  ];
  const p = planRuleChange({ existing, change: { category: 'sound', item_key: 'church', amount: 660, valid_from: '2081-03-10' }, today: '2081-01-01' });
  assert.equal(p.ok, true);
  assert.deepEqual(p.ops[0], { type: 'close', id: 'a', from: null, valid_until: '2081-03-09' });
  assert.equal(p.ops[1].row.valid_until, '2081-12-31');
  assert.ok(p.warnings.includes('future_rule_kept'));
  assert.deepEqual(planRuleChange({ existing, change: { category: 'sound', item_key: 'church', amount: 1, valid_from: '2080-01-01' } }).errors, ['rule_exists_same_start']);
  assert.deepEqual(planRuleChange({ existing, change: { category: 'sound', item_key: 'church', amount: 1 } }).errors, ['valid_from_required']);
  assert.ok(planRuleChange({ existing, change: { category: 'sound', item_key: 'church', amount: 1, valid_from: '2080-06-01' }, today: '2081-01-01' }).warnings.includes('retroactive_start'));
  assert.equal(shiftDay('2081-03-01', -1), '2081-02-28');
});
