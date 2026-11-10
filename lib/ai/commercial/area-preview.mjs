// Prévia de uma localidade na Central: preços HERDADOS da faixa, deslocamento efetivo e origem das taxas,
// calculados pelo MESMO motor da Nara (calculateQuote) — o que aparece aqui é o que a Nara cobra.
import { calculateQuote, pickRule } from './pricing.mjs';
import { tierLabel, TIER_FORMATIONS } from '../../quotes/tiers.mjs';

const LABEL = { duo: 'Duo', trio: 'Trio', quarteto: 'Quarteto', quinteto: 'Quinteto', sexteto: 'Sexteto' };

export function previewArea({ area, rules = [], date = new Date().toISOString().slice(0, 10) }) {
  const tier = area?.price_tier && area.price_tier !== 'base' ? area.price_tier : 'base';
  // A prévia considera a área mesmo inativa (para mostrar o que ela herdaria ao reativar).
  const self = { ...area, active: true };
  const prices = TIER_FORMATIONS.map((f) => {
    const q = calculateQuote({ date, formation: LABEL[f], location: area.name }, { rules, areas: [self] });
    return { formation: LABEL[f], amount: q.ok ? q.items.find((i) => i.key === 'ceremony')?.amount ?? null : null };
  });
  const probe = calculateQuote({ date, formation: 'Trio', location: area.name, hasSound: true }, { rules, areas: [self] });
  const travelItem = probe.ok ? probe.items.find((i) => i.key === 'travel') : null;
  const soundItem = probe.ok ? probe.items.find((i) => i.key === 'sound_travel') : null;
  const standardRule = pickRule(rules, 'transport', 'band_trip', date) ?? pickRule(rules, 'transport', 'standard_trip', date);
  const travel = travelItem
    ? { amount: travelItem.amount, source: area.travel_fee != null ? 'area' : 'rule', label: area.travel_fee != null ? 'taxa própria da localidade' : 'regra padrão de deslocamento (Tabelas)' }
    : { amount: 0, source: null, label: tier === 'base' ? 'região-base: sem deslocamento' : 'sem deslocamento' };
  const soundTravel = soundItem
    ? { amount: soundItem.amount, source: Number(area.sound_travel_fee) > 0 ? 'area' : 'rule', label: Number(area.sound_travel_fee) > 0 ? 'taxa própria da localidade' : 'regra de deslocamento do som (Tabelas)' }
    : { amount: 0, source: null, label: 'sem deslocamento do som' };

  const issues = [];
  if (area.active === false) issues.push({ code: 'inactive', text: 'Inativa: a Nara ignora esta localidade.' });
  if (area.status === 'blocked') issues.push({ code: 'blocked', text: 'Bloqueada: a Nara transfere para a equipe.' });
  if (area.status === 'conditional') issues.push({ code: 'conditional', text: 'Condicional: a Nara não informa valores sem aprovação.' });
  const priced = prices.filter((p) => p.amount != null).length;
  if (!priced) issues.push({ code: 'tier_without_prices', text: `Faixa "${tierLabel(tier)}" sem preços na data: a Nara não informa valores e gera pendência.` });
  else if (priced < prices.length) issues.push({ code: 'tier_partial', text: `Faixa "${tierLabel(tier)}" sem preço para ${prices.filter((p) => p.amount == null).map((p) => p.formation).join(', ')}.` });
  if (tier !== 'base' && !travelItem) issues.push({ code: 'outside_base_without_travel', text: 'Fora da região-base sem taxa de deslocamento (nem da localidade, nem regra padrão).' });
  if (tier === 'base' && Number(area.travel_fee) > 0) issues.push({ code: 'base_with_travel', text: 'Região-base com taxa de deslocamento própria: confira se é intencional.' });

  return {
    tier, tier_label: tierLabel(tier), date, prices, travel, sound_travel: soundTravel,
    standard_travel_rule: standardRule ?? null, issues,
  };
}
