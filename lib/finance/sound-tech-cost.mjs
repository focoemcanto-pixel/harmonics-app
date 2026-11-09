/**
 * Custo interno do técnico de som por duração do receptivo (financeiro). Nunca exibido ao cliente.
 *
 * Fonte: regras oficiais musician_fee/sound_tech, sound_tech_reception_1h, sound_tech_reception_2h
 * vigentes na data do evento (as mesmas usadas na margem da sonorização). Sem regra aplicável (sem
 * regras cadastradas, receptivo acima de 2h ou fracionado), usa o custo padrão do financeiro
 * (finance_cost_defaults.sound_default_cost / op_finance_defaults cost:sonorização) e sinaliza revisão.
 *
 * Duplicidade: quando a escala do evento já tem um técnico de som (papel "Som"), o custo dele já entra
 * pela escala; a linha genérica "Sonorização" não deve ser somada de novo.
 */
import { soundRuleKeys } from '../quotes/sound-rules.mjs';
import { pickOfficial } from '../quotes/official-prices.mjs';

const norm = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Papel de escala que corresponde ao técnico de som. */
export function isSoundTechRole(role) {
  const r = norm(role);
  return /^(som|sonorizac\w*|sonorizador\w*|tecnico( de)? som|tecnico de audio|operador( de)? som|audio)\b/.test(r);
}

/**
 * @returns {{ amount: number, source: 'official'|'fallback'|null, requiresReview: boolean, key: string|null }}
 */
export function soundTechCostFor({ rules = [], date, receptionHours = 0, fallback = 0 }) {
  const d = (date && String(date).slice(0, 10)) || new Date().toISOString().slice(0, 10);
  const keys = soundRuleKeys(receptionHours);
  const official = keys.cost ? pickOfficial(rules, 'musician_fee', keys.cost, d) : null;
  if (official != null) return { amount: official, source: 'official', requiresReview: false, key: keys.cost };
  const reserve = Number(fallback) > 0 ? Number(fallback) : 0;
  return { amount: reserve, source: reserve ? 'fallback' : null, requiresReview: keys.requiresValidation, key: keys.cost };
}

/** true se a escala do evento já tem técnico de som. */
export function scaleHasSoundTech(musicians = [], eventId) {
  return (musicians || []).some((m) => (eventId == null || m.event_id === eventId) && isSoundTechRole(m.role));
}
