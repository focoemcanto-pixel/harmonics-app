/**
 * Public, approved reception ADD-ON matrix (not a full event quote).
 * The ceremony formation can differ from the reception formation. Each price
 * comes from the exact same quote rules and regional checks as other quotes.
 * The general add-on rules may be shared with ate120 when explicitly enabled.
 */
import { calculateQuote, formatBRL, hasRegionIssue, pickRule } from './pricing.mjs';

export const RECEPTION_FORMATIONS = Object.freeze(['Duo','Trio','Quarteto','Quinteto','Sexteto']);
export const RECEPTION_HOURS = Object.freeze([1,2,3]);

export function receptionMatrix({ date = null, location, rules = [], pricing = null, areas = [], settings = {}, standalone = false, shareGeneral = false } = {}) {
  if (!location) return { ok: false, missing: ['cidade'] };
  const referenceDate = date || new Date().toISOString().slice(0, 10);
  const tables = {
    rules, pricing, areas,
    logisticsRules: settings.logistics_rules || {},
    minMarginPct: settings.min_margin_pct ?? null,
  };
  const rows = RECEPTION_FORMATIONS.map(formation => ({
    formation,
    prices: RECEPTION_HOURS.map(hours => {
      if (shareGeneral && !standalone) {
        return pickRule(rules, 'reception', `${formation.toLowerCase()}_${hours}h`, referenceDate) || null;
      }
      const quote = calculateQuote({
        date, location, formation, hasSound: false,
        ...(standalone ? { modality: 'show', hours } : { reception: { formation, hours } }),
      }, tables);
      const item = quote.items?.find(i => i.key === (standalone ? 'show' : 'reception'));
      // A regional tier with unconfigured rules must never inherit the base.
      if (!quote.ok || hasRegionIssue(quote) || quote.approvals?.includes('territory_conditional')
          || !item || !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0) return null;
      return Number(item.amount);
    }),
  }));
  if (!rows.some(row => row.prices.some(p => p !== null))) {
    return { ok: false, status: 'pricing_review_required' };
  }
  const text = [
    standalone ? '🎶 Festas, receptivos e coquetéis — apresentação avulsa' : '🎶 Receptivo após a cerimônia — valores adicionais',
    ...rows.map(row => `• ${row.formation}: ${row.prices.map((amount, i) =>
      `${RECEPTION_HOURS[i]}h ${amount === null ? 'a confirmar' : formatBRL(amount)}`).join(' · ')}`),
    '',
    standalone ? 'Valores da apresentação avulsa, sem contratação de cerimônia.' : 'A formação do receptivo pode ser diferente da escolhida para a cerimônia. O valor do receptivo é SOMADO ao valor da formação da cerimônia.',
    'Som, deslocamento e outros serviços, quando aplicáveis, são calculados à parte e sujeitos à validação da proposta. Nenhuma formação ou duração foi escolhida por você ainda.',
    'Qual formação e duração você gostaria para o receptivo? 😊',
  ].join('\n');
  return { ok: true, status: 'matrix_ready', rows, text };
}
