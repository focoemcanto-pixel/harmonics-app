/**
 * Preços oficiais por data do evento (quote_price_rules), a mesma fonte da Nara e de Orçamentos.
 * Usado pela tela Eventos (preenchimento automático) e pelo painel do cliente (ofertas de receptivo).
 *
 * - A regra vigente na data do evento vence; com duas vigentes, a de início mais recente.
 * - Sem regra oficial para o item, usa a reserva informada pelo chamador (tabela do módulo Eventos).
 * - Nunca recalcula valores já salvos: só serve para sugerir valores novos.
 * - Custos internos (musician_fee) nunca saem por aqui para telas de cliente: ver CLIENT_PRICE_CATEGORIES.
 */
import { resolveSoundPricing, hasDurationSoundRules } from './sound-rules.mjs';

export const CLIENT_PRICE_CATEGORIES = Object.freeze(['ceremony', 'reception', 'sound', 'transport']);

const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null);
const slug = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function formationKey(formation) {
  const s = slug(formation);
  for (const k of ['solo', 'duo', 'trio', 'quarteto', 'quinteto', 'sexteto', 'septeto']) if (s.startsWith(k.slice(0, 4))) return k;
  return '';
}

export function isRuleValidOn(rule, date) {
  const from = day(rule?.valid_from) || '0000-01-01';
  const until = day(rule?.valid_until);
  return from <= date && (!until || until >= date);
}

/** Valor vigente (número > 0) ou null. */
export function pickOfficial(rules, category, key, date) {
  const r = (rules || [])
    .filter((x) => x.category === category && x.item_key === key && isRuleValidOn(x, date))
    .sort((a, b) => String(day(b.valid_from)).localeCompare(String(day(a.valid_from))))[0];
  const n = Number(r?.amount);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const refDate = (date) => day(date) || new Date().toISOString().slice(0, 10);
const positive = (v) => (Number(v) > 0 ? Number(v) : null);

/**
 * Sugestão de preços para um evento. `fallback` = { ceremony, reception, sound } vindos da tabela do Eventos.
 * Retorna também a origem de cada valor ('official' | 'fallback' | null).
 */
export function resolveEventPrices({ rules = [], date, formation, receptionHours = 0, hasSound = false, fallback = {} }) {
  const d = refDate(date);
  const f = formationKey(formation);
  const h = Math.max(0, parseInt(receptionHours, 10) || 0);
  const sources = {};
  const take = (name, official, reserve) => {
    if (official != null) { sources[name] = 'official'; return official; }
    const r = positive(reserve);
    sources[name] = r != null ? 'fallback' : null;
    return r ?? 0;
  };
  const ceremony = take('ceremony', f ? pickOfficial(rules, 'ceremony', f, d) : null, fallback.ceremony);
  const reception = h ? take('reception', f ? pickOfficial(rules, 'reception', `${f}_${h}h`, d) : null, fallback.reception) : 0;
  let sound = 0;
  let soundRequiresValidation = false;
  if (hasSound) {
    const plan = resolveSoundPricing({
      receptionHours: h,
      pick: (c, k) => pickOfficial(rules, c, k, d),
      hasDurationRules: hasDurationSoundRules(rules, (r) => isRuleValidOn(r, d)),
    });
    soundRequiresValidation = plan.requiresValidation;
    sound = soundRequiresValidation ? 0 : take('sound', plan.amount, plan.legacy || !h ? fallback.sound : null);
    if (soundRequiresValidation) sources.sound = null;
  }
  return { date: d, ceremony, reception, sound, soundRequiresValidation, sources };
}

/** Preços de receptivo 1h/2h/3h da formação na data (ofertas do painel do cliente). */
export function receptionOffer({ rules = [], date, formation, fallback = {} }) {
  const d = refDate(date);
  const f = formationKey(formation);
  const out = {};
  for (const h of [1, 2, 3]) {
    out[h] = (f ? pickOfficial(rules, 'reception', `${f}_${h}h`, d) : null) ?? positive(fallback[h]) ?? 0;
  }
  return out;
}
