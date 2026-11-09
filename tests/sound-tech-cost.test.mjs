// Custo do técnico por duração e não duplicidade no Financeiro Operacional — dados 100% sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { soundTechCostFor, isSoundTechRole, scaleHasSoundTech } from '../lib/finance/sound-tech-cost.mjs';
import { suggestedCosts } from '../lib/operational-finance/model.mjs';
import { getAutomaticCosts } from '../lib/eventos/eventos-finance.js';

const TECH = [
  { category: 'musician_fee', item_key: 'sound_tech', amount: 210, valid_from: '2090-01-01', valid_until: null },
  { category: 'musician_fee', item_key: 'sound_tech_reception_1h', amount: 320, valid_from: '2090-01-01', valid_until: null },
  { category: 'musician_fee', item_key: 'sound_tech_reception_2h', amount: 430, valid_from: '2090-01-01', valid_until: null },
];
const DEFAULTS = [
  { key: 'general:musician', amount_cents: 33300 },
  { key: 'cost:sonorização', amount_cents: 19900 },
  { key: 'cost:transporte', amount_cents: 11100 },
];
let n = 0; const id = () => `id-${++n}`;
const ev = (o = {}) => ({ id: 'e1', event_date: '2090-05-05', has_sound: true, has_transport: false, reception_hours: 0, ...o });
const violin = { id: 's1', event_id: 'e1', musician_id: 'm1', name: 'Pessoa A', role: 'Violino' };
const tech = { id: 's2', event_id: 'e1', musician_id: 'm2', name: 'Pessoa B', role: 'Som' };
const sum = (costs) => costs.reduce((t, c) => t + (c.amount_cents || 0), 0);

test('papel de técnico de som e custo por duração com reserva', () => {
  assert.deepEqual(['Som', 'som', 'Técnico de som', 'Sonorização', 'Sax', 'Somador'].map(isSoundTechRole), [true, true, true, true, false, false]);
  assert.deepEqual([0, 1, 2].map((h) => soundTechCostFor({ rules: TECH, date: '2090-05-05', receptionHours: h }).amount), [210, 320, 430]);
  const long = soundTechCostFor({ rules: TECH, date: '2090-05-05', receptionHours: 3, fallback: 199 });
  assert.deepEqual([long.amount, long.source, long.requiresReview], [199, 'fallback', true]);
  assert.equal(soundTechCostFor({ rules: TECH, date: '2089-12-31', fallback: 199 }).source, 'fallback', 'antes da vigência usa o padrão');
  assert.equal(scaleHasSoundTech([violin, tech], 'e1'), true);
});

test('custos automáticos de evento novo: técnico por duração; sem regras, comportamento anterior', () => {
  const pricing = { musician_unit_cost: 100, sound_default_cost: 199, transport_default_cost: 0 };
  const base = { formation: 'Trio', hasSound: true, hasTransport: false, transportPrice: 0, pricing };
  assert.equal(getAutomaticCosts(base).soundCost, 199);
  assert.equal(getAutomaticCosts({ ...base, receptionHours: 2, eventDate: '2090-05-05', soundTechRules: TECH }).soundCost, 430);
  assert.equal(getAutomaticCosts({ ...base, receptionHours: 3, eventDate: '2090-05-05', soundTechRules: TECH }).soundCost, 199);
  assert.equal(getAutomaticCosts({ ...base, hasSound: false, soundTechRules: TECH }).soundCost, 0);
});

test('ficha nova: técnico na escala dispensa a linha genérica de Sonorização', () => {
  const withTech = suggestedCosts(ev({ reception_hours: 1 }), undefined, [violin, tech], DEFAULTS, id, { soundTechRules: TECH });
  assert.equal(withTech.filter((c) => c.category === 'sonorização').length, 0);
  assert.equal(withTech.find((c) => c.scale_id === 's2').amount_cents, 32000, 'técnico pela duração');
  assert.equal(withTech.find((c) => c.scale_id === 's1').amount_cents, 33300);
  assert.equal(sum(withTech), 33300 + 32000);
  const noTech = suggestedCosts(ev({ reception_hours: 2 }), undefined, [violin], DEFAULTS, id, { soundTechRules: TECH });
  assert.equal(noTech.find((c) => c.category === 'sonorização').amount_cents, 43000, 'linha genérica pela duração');
  const legacy = suggestedCosts(ev(), undefined, [violin], DEFAULTS, id);
  assert.equal(legacy.find((c) => c.category === 'sonorização').amount_cents, 19900, 'sem regras: valor padrão');
});

test('ficha salva: nada é reescrito; técnico novo com Sonorização ativa entra excluído (sem somar)', () => {
  const saved = [
    { id: 'x1', scale_id: 's1', category: 'musician', amount_cents: 12345, status: 'paid' },
    { id: 'x2', default_key: 'cost:sonorização', category: 'sonorização', amount_cents: 19900, status: 'predicted' },
  ];
  const out = suggestedCosts(ev(), saved, [violin, tech], DEFAULTS, id, { soundTechRules: TECH });
  assert.deepEqual(out.slice(0, 2), saved, 'linhas salvas intactas');
  const added = out.find((c) => c.scale_id === 's2');
  assert.equal(added.excluded, true);
  assert.equal(added.amount_cents, 0);
  assert.equal(added.excluded_amount_cents, 21000);
  assert.equal(sum(out), 12345 + 19900, 'total sem duplicidade');
  const savedNoSound = [{ id: 'x1', scale_id: 's1', category: 'musician', amount_cents: 12345 }];
  const out2 = suggestedCosts(ev(), savedNoSound, [violin, tech], DEFAULTS, id, { soundTechRules: TECH });
  assert.equal(out2.find((c) => c.scale_id === 's2').amount_cents, 21000);
  assert.equal(out2.length, 2, 'ficha salva não ganha linha genérica');
});
