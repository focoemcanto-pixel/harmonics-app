/**
 * Helper para validação de timing de regras de automação por data.
 * Usa timezone America/Sao_Paulo para evitar erros por UTC puro.
 */

/**
 * Retorna a data de hoje no timezone de São Paulo (formato YYYY-MM-DD)
 * @returns {string} data no formato YYYY-MM-DD
 */
export function getTodaySaoPaulo() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const day = parts.find((p) => p.type === 'day')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const year = parts.find((p) => p.type === 'year')?.value;

  return `${year}-${month}-${day}`;
}

/**
 * Adiciona N dias a uma data YYYY-MM-DD usando aritmética UTC (sem timezone shift)
 * @param {string} dateStr - data no formato YYYY-MM-DD
 * @param {number} days - número de dias a adicionar (pode ser negativo)
 * @returns {string} data resultante no formato YYYY-MM-DD
 */
function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Retorna a data-alvo do evento que deve disparar a regra hoje.
 *
 * - days_before: evento deve acontecer em N dias → event_date alvo = hoje + N
 * - days_after:  evento aconteceu N dias atrás  → event_date alvo = hoje - N
 *
 * @param {Object} rule - regra com days_before e/ou days_after
 * @returns {string|null} data YYYY-MM-DD ou null se regra sem timing por data
 */
export function getTargetDateForRule(rule) {
  const today = getTodaySaoPaulo();

  if (rule.days_before != null) {
    return addDays(today, rule.days_before);
  }

  if (rule.days_after != null) {
    return addDays(today, -rule.days_after);
  }

  return null;
}

/**
 * Valida se hoje é o dia correto para disparar a regra para um evento específico.
 *
 * @param {Object} rule - regra com days_before e/ou days_after
 * @param {string} eventDate - data do evento no formato YYYY-MM-DD
 * @returns {boolean}
 */
export function dateMatchesRule(rule, eventDate) {
  if (!eventDate) return false;
  const target = getTargetDateForRule(rule);
  if (!target) return false;
  return target === eventDate;
}
