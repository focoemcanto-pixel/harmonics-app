// Sonorização por duração e troca de vigência (dados 100% sintéticos).
import test from 'node:test';
import assert from 'node:assert/strict';
import { soundRuleKeys, resolveSoundPricing, hasDurationSoundRules, SOUND_MIN_MARGIN } from '../lib/quotes/sound-rules.mjs';
import { calculateQuote, pickRule } from '../lib/ai/commercial/pricing.mjs';

const valid = (d) => (r) => r.valid_from <= d && (!r.valid_until || r.valid_until >= d);
const pickOn = (rules, d) => (c, k) => {
  const r = rules.filter((x) => x.category === c && x.item_key === k && valid(d)(x)).sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];
  return r ? Number(r.amount) : null;
};

// Cenário sintético: esquema antigo até 2090-12-31, novo por duração a partir de 2091-01-01.
const RULES = [
  { category: 'sound', item_key: 'church', amount: 950, valid_from: '2080-01-01', valid_until: '2090-12-31' },
  { category: 'sound', item_key: 'church_reception', amount: 1700, valid_from: '2080-01-01', valid_until: '2090-12-31' },
  { category: 'sound', item_key: 'church', amount: 710, valid_from: '2091-01-01' },
  { category: 'sound', item_key: 'church_reception_1h', amount: 820, valid_from: '2091-01-01' },
  { category: 'sound', item_key: 'church_reception_2h', amount: 930, valid_from: '2091-01-01' },
  { category: 'musician_fee', item_key: 'sound_tech', amount: 210, valid_from: '2091-01-01' },
  { category: 'musician_fee', item_key: 'sound_tech_reception_1h', amount: 320, valid_from: '2091-01-01' },
  { category: 'musician_fee', item_key: 'sound_tech_reception_2h', amount: 430, valid_from: '2091-01-01' },
  { category: 'ceremony', item_key: 'trio', amount: 1111, valid_from: '2080-01-01', valid_until: '2091-05-31' },
  { category: 'ceremony', item_key: 'trio', amount: 2222, valid_from: '2091-06-01' },
];
const plan = (h, d) => resolveSoundPricing({ receptionHours: h, pick: pickOn(RULES, d), hasDurationRules: hasDurationSoundRules(RULES, valid(d)) });

test('som: chaves por duração; acima de 2h ou fracionado exige validação', () => {
  assert.deepEqual(soundRuleKeys(0), { price: 'church', cost: 'sound_tech', hours: 0, requiresValidation: false });
  assert.equal(soundRuleKeys(1).price, 'church_reception_1h');
  assert.equal(soundRuleKeys(2).cost, 'sound_tech_reception_2h');
  assert.equal(soundRuleKeys(3).requiresValidation, true);
  assert.equal(soundRuleKeys(1.5).requiresValidation, true);
});

test('som: novo esquema calcula preço, técnico e margem; antigo continua igual antes da migração', () => {
  assert.deepEqual([plan(0, '2091-03-01').amount, plan(0, '2091-03-01').techCost, plan(0, '2091-03-01').margin], [710, 210, 500]);
  assert.deepEqual([plan(1, '2091-03-01').amount, plan(1, '2091-03-01').margin], [820, 500]);
  assert.deepEqual([plan(2, '2091-03-01').amount, plan(2, '2091-03-01').margin], [930, 500]);
  assert.equal(plan(3, '2091-03-01').requiresValidation, true);
  assert.equal(plan(3, '2091-03-01').amount, null, 'regra antiga encerrada não é usada como reserva');
  // Antes da troca (esquema antigo): qualquer duração usa a regra única, sem validação extra.
  assert.deepEqual([plan(0, '2090-06-01').amount, plan(1, '2090-06-01').amount, plan(3, '2090-06-01').amount], [950, 1700, 1700]);
  assert.equal(plan(3, '2090-06-01').legacy, true);
  assert.equal(SOUND_MIN_MARGIN, 500);
  const low = resolveSoundPricing({ receptionHours: 0, pick: (c) => (c === 'sound' ? 600 : 250), hasDurationRules: true });
  assert.equal(low.marginBelowMinimum, true);
});

test('vigência: a data do evento escolhe a tabela no limite da troca', () => {
  assert.equal(pickRule(RULES, 'ceremony', 'trio', '2091-05-31'), 1111);
  assert.equal(pickRule(RULES, 'ceremony', 'trio', '2091-06-01'), 2222);
});

test('Nara: som por duração, técnico no custo interno e validação para receptivo longo', () => {
  const base = { date: '2091-07-01', formation: 'trio', instruments: 'voz, violino, teclado', hasSound: true };
  const q1 = calculateQuote({ ...base, reception: { formation: 'trio', hours: 1 } }, { rules: [...RULES, { category: 'reception', item_key: 'trio_1h', amount: 400, valid_from: '2080-01-01' }] });
  assert.equal(q1.items.find((i) => i.key === 'sound').amount, 820);
  const q0 = calculateQuote({ ...base, reception: { hours: 0 } }, { rules: [...RULES, { category: 'musician_fee', item_key: 'musician_local', amount: 100, valid_from: '2080-01-01' }] });
  assert.equal(q0.items.find((i) => i.key === 'sound').amount, 710);
  assert.equal(q0.internalCost.soundTech, 210);
  assert.equal(q0.internalCost.total, 100 * 2 + 210, 'vocal principal sem cachê + técnico');
  const q3 = calculateQuote({ ...base, reception: { formation: 'trio', hours: 3 } }, { rules: [...RULES, { category: 'reception', item_key: 'trio_3h', amount: 600, valid_from: '2080-01-01' }] });
  assert.equal(q3.items.some((i) => i.key === 'sound'), false);
  assert.ok(q3.approvals.includes('sound_duration_requires_validation'));
  assert.equal(q3.final, false);
});
