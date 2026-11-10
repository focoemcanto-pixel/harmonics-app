// Faixas regionais de preço (Manual §4) sobre a tabela oficial quote_price_rules, sem schema novo:
// região-base = item sem sufixo (ex.: "trio"); outra faixa = "<item>@<faixa>" (ex.: "trio@metro").
// O motor de preço (lib/ai/commercial/pricing.mjs) já resolve a faixa da localidade por esse sufixo.

export const BUILTIN_TIERS = Object.freeze(['base', 'metro', 'ate120']);
export const TIER_LABELS = Object.freeze({ base: 'Região-base', metro: 'Metropolitana', ate120: 'Até 120 km' });
export const TIER_FORMATIONS = Object.freeze(['duo', 'trio', 'quarteto', 'quinteto', 'sexteto']);
export const RECEPTION_HOURS = Object.freeze([1, 2, 3]);
const FORMATION_LABELS = { solo: 'Solo', duo: 'Duo', trio: 'Trio', quarteto: 'Quarteto', quinteto: 'Quinteto', sexteto: 'Sexteto', septeto: 'Septeto' };

const day = (v) => (v ? String(v).slice(0, 10) : null);

/** Nome livre -> identificador de faixa (minúsculas, sem acento, hífens). Inválido => null. */
export function normalizeTierSlug(name) {
  const s = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  if (!s || s.length < 2) return null;
  if (s === 'regiao-base') return 'base';
  return s;
}

export function tierLabel(slug) {
  if (!slug || slug === 'base') return TIER_LABELS.base;
  if (TIER_LABELS[slug]) return TIER_LABELS[slug];
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** "trio@metro" -> { key: 'trio', tier: 'metro' }; "trio" -> { key: 'trio', tier: 'base' }. */
export function parseTieredKey(itemKey) {
  const [key, tier] = String(itemKey || '').split('@');
  return { key, tier: tier || 'base' };
}

export function tieredKey(key, tier) {
  return !tier || tier === 'base' ? key : `${key}@${tier}`;
}

/** Faixas conhecidas: as padrão + as que já têm preço + as usadas por localidades (personalizadas). */
export function listTiers({ rules = [], areas = [] } = {}) {
  const out = new Set(BUILTIN_TIERS);
  for (const r of rules) if (String(r.item_key || '').includes('@')) out.add(parseTieredKey(r.item_key).tier);
  for (const a of areas) if (a?.price_tier && a.price_tier !== 'custom') out.add(a.price_tier);
  return [...out].map((slug) => ({ slug, label: tierLabel(slug), builtin: BUILTIN_TIERS.includes(slug) }));
}

export function itemLabel(category, key, tier) {
  const t = tier && tier !== 'base' ? ` — ${tierLabel(tier)}` : '';
  if (category === 'ceremony') return `Cerimônia ${FORMATION_LABELS[key] || key}${t}`;
  if (category === 'reception') {
    const [f, h] = String(key).split('_');
    return `Receptivo ${FORMATION_LABELS[f] || f} ${String(h || '').replace('h', '')}h${t}`;
  }
  return `${key}${t}`;
}

/** Itens-base exibidos na grade de uma categoria (cerimônia: formações; receptivo: formação × horas). */
export function gridItems(category) {
  if (category === 'reception') return TIER_FORMATIONS.flatMap((f) => RECEPTION_HOURS.map((h) => `${f}_${h}h`));
  return [...TIER_FORMATIONS];
}

/**
 * Grade formação × faixa. Cada célula traz a regra vigente na data de referência, as futuras e o histórico,
 * só a partir das regras oficiais existentes (nenhum valor é inventado: célula sem regra fica vazia).
 */
export function buildTierGrid({ rules = [], category = 'ceremony', tiers = [], refDate = new Date().toISOString().slice(0, 10) } = {}) {
  const items = gridItems(category);
  const slugs = tiers.length ? tiers.map((t) => (typeof t === 'string' ? t : t.slug)) : [...BUILTIN_TIERS];
  return items.map((key) => ({
    key,
    label: itemLabel(category, key),
    cells: slugs.map((tier) => {
      const itemKey = tieredKey(key, tier);
      const rows = rules.filter((r) => r.category === category && r.item_key === itemKey)
        .sort((a, b) => String(day(a.valid_from)).localeCompare(String(day(b.valid_from))));
      const current = rows.find((r) => day(r.valid_from) <= refDate && (!r.valid_until || day(r.valid_until) >= refDate)) || null;
      const future = rows.filter((r) => day(r.valid_from) > refDate);
      return { tier, itemKey, label: itemLabel(category, key, tier), current, future, history: rows };
    }),
  }));
}
