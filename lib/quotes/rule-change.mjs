/**
 * Planejamento de alteração de preço com vigência (quote_price_rules), sem sobrescrever histórico.
 * Uma mudança cria uma regra nova a partir de `valid_from` e encerra na véspera a regra que estava
 * vigente; se já existir uma regra futura, a nova termina na véspera dela. Função pura: só devolve o plano.
 */
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null);

export function shiftDay(iso, delta) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export const RULE_CATEGORIES = Object.freeze(['ceremony', 'reception', 'sound', 'transport', 'musician_fee', 'other']);

/**
 * @param existing regras atuais (todas do workspace ou só da chave)
 * @param change { category, item_key, label, amount, valid_from }
 * @param today data de referência (AAAA-MM-DD) para avisos de retroatividade
 */
export function planRuleChange({ existing = [], change = {}, today = new Date().toISOString().slice(0, 10) }) {
  const errors = [];
  const warnings = [];
  const category = String(change.category || '');
  const itemKey = String(change.item_key || '').trim();
  const amount = Number(change.amount);
  const validFrom = String(change.valid_from || '');
  if (!RULE_CATEGORIES.includes(category)) errors.push('category_invalid');
  if (!itemKey || itemKey.length > 80) errors.push('item_key_invalid');
  if (!Number.isFinite(amount) || amount < 0) errors.push('amount_invalid');
  if (!ISO.test(validFrom)) errors.push('valid_from_required');
  if (errors.length) return { ok: false, errors, warnings, ops: [] };

  const rules = existing
    .filter((r) => r.category === category && r.item_key === itemKey)
    .map((r) => ({ ...r, valid_from: day(r.valid_from), valid_until: day(r.valid_until) }))
    .sort((a, b) => a.valid_from.localeCompare(b.valid_from));
  if (rules.some((r) => r.valid_from === validFrom)) return { ok: false, errors: ['rule_exists_same_start'], warnings, ops: [] };

  const ops = [];
  const current = [...rules].reverse().find((r) => r.valid_from < validFrom && (!r.valid_until || r.valid_until >= validFrom));
  if (current) {
    if (Number(current.amount) === amount) warnings.push('same_amount_as_current');
    ops.push({ type: 'close', id: current.id, from: current.valid_until, valid_until: shiftDay(validFrom, -1) });
  }
  const next = rules.find((r) => r.valid_from > validFrom);
  const validUntil = next ? shiftDay(next.valid_from, -1) : null;
  if (next) warnings.push('future_rule_kept');
  if (validFrom < today) warnings.push('retroactive_start');
  ops.push({
    type: 'insert',
    row: { category, item_key: itemKey, label: String(change.label || itemKey).slice(0, 120), amount, valid_from: validFrom, valid_until: validUntil },
  });
  return { ok: true, errors, warnings, ops, current: current || null, next: next || null };
}
