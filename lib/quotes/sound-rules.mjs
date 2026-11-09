/**
 * Sonorização de cerimônia por duração do receptivo (regra única para a IA e o módulo Orçamentos).
 *
 * Regras oficiais (quote_price_rules):
 *   sound/church                    cerimônia sem receptivo
 *   sound/church_reception_<h>h     cerimônia + h horas de receptivo (h = 1..SOUND_MAX_AUTO_RECEPTION_HOURS)
 *   musician_fee/sound_tech[...]    custo interno do técnico (mesmas chaves com prefixo sound_tech), nunca exibido ao cliente
 *
 * Receptivo acima do limite (ou fracionado) não tem preço automático: exige validação humana.
 * Compatibilidade: enquanto não houver nenhuma regra church_reception_<h>h vigente na data, vale o
 * esquema anterior (sound/church_reception único), para que o deploy do código não mude preços
 * antes da migração dos dados ser aprovada.
 */
export const SOUND_MAX_AUTO_RECEPTION_HOURS = 2;
export const SOUND_MIN_MARGIN = 500;

const DURATION_KEY = /^church_reception_\d+h$/;

/** Chaves de preço e custo para a duração de receptivo informada. */
export function soundRuleKeys(receptionHours) {
  const h = Number(receptionHours || 0);
  if (!Number.isFinite(h) || h <= 0) return { price: 'church', cost: 'sound_tech', hours: 0, requiresValidation: false };
  if (!Number.isInteger(h) || h > SOUND_MAX_AUTO_RECEPTION_HOURS) return { price: null, cost: null, hours: h, requiresValidation: true };
  return { price: `church_reception_${h}h`, cost: `sound_tech_reception_${h}h`, hours: h, requiresValidation: false };
}

/**
 * Resolve preço, custo do técnico e margem da sonorização.
 * `pick(category, key)` deve devolver o valor vigente na data do evento (número > 0) ou null.
 * `hasDurationRules` indica se existe alguma regra church_reception_<h>h vigente na data.
 */
export function resolveSoundPricing({ receptionHours = 0, pick, hasDurationRules = false, minMargin = SOUND_MIN_MARGIN }) {
  const keys = soundRuleKeys(receptionHours);
  if (keys.hours > 0 && !hasDurationRules) {
    // Esquema anterior (antes da migração aprovada): regra única de cerimônia + receptivo.
    const amount = pick('sound', 'church_reception') ?? pick('sound', 'church');
    return { amount, techCost: null, margin: null, key: 'church_reception', legacy: true, requiresValidation: false, marginBelowMinimum: false };
  }
  if (keys.requiresValidation) {
    return { amount: null, techCost: null, margin: null, key: null, legacy: false, requiresValidation: true, marginBelowMinimum: false };
  }
  const amount = pick('sound', keys.price);
  const techCost = pick('musician_fee', keys.cost);
  const margin = amount != null && techCost != null ? Math.round((amount - techCost) * 100) / 100 : null;
  return {
    amount, techCost, margin, key: keys.price, legacy: false, requiresValidation: false,
    marginBelowMinimum: margin !== null && margin < minMargin,
  };
}

/** true se alguma regra de som por duração estiver vigente na data (aceita linhas cruas do banco). */
export function hasDurationSoundRules(rules = [], isValidOn) {
  return (rules || []).some((r) => r.category === 'sound' && DURATION_KEY.test(String(r.item_key)) && isValidOn(r));
}
