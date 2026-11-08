/**
 * Precificação determinística da IA comercial. Nunca inventa valores:
 *  - Fonte 1: quote_price_rules vigentes na data (mesmas categorias do módulo Orçamentos:
 *    ceremony/<formação>, reception/<formação>_<h>h, sound/church|church_reception,
 *    musician_fee/*, transport/*).
 *  - Fonte 2: pricing_settings do workspace (tabela de Eventos), por componente.
 *  - Logística: território cadastrado (ai_service_areas) ou regras de km do workspace
 *    (logistics_rules) com distância rodoviária; sem dado => pendente de revisão humana.
 * Exceções (território condicional, margem abaixo do mínimo, logística não resolvida)
 * marcam requiresApproval e impedem fechamento automático.
 */
import {
  normalizeFormation,
  getAutomaticFormationPrice,
  getAutomaticReceptionPrice,
} from '../../eventos/eventos-finance';

export const FORMATION_SIZE = Object.freeze({ Solo: 1, Duo: 2, Trio: 3, Quarteto: 4, Quinteto: 5, Sexteto: 6, Septeto: 7 });

const money = (v) => Math.round((Number(v) || 0) * 100) / 100;
const slug = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function formationSize(formation) {
  return FORMATION_SIZE[normalizeFormation(formation)] || 0;
}

export function parseInstruments(text) {
  return String(text || '')
    .split(/,|\s+e\s+|;|\+|\//i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isoDay(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function ruleValid(rule, date) {
  const from = isoDay(rule.valid_from) || '0000-01-01';
  const until = isoDay(rule.valid_until);
  return from <= date && (!until || until >= date);
}

export function pickRule(rules, category, key, date) {
  const candidates = (rules || [])
    .filter((r) => r.category === category && r.item_key === key && ruleValid(r, date))
    .sort((a, b) => String(isoDay(b.valid_from) || '').localeCompare(String(isoDay(a.valid_from) || '')));
  const amount = Number(candidates[0]?.amount);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** Território pelo texto do local (cidade/bairro/endereço). Retorna o mais específico. */
export function resolveTerritory(areas = [], locationText = '') {
  const text = ` ${slug(locationText).replace(/[^a-z0-9]+/g, ' ')} `;
  if (!text.trim()) return null;
  let best = null;
  for (const area of areas) {
    if (area.active === false) continue;
    const terms = [area.name, ...(area.match_terms || [])].map(slug).filter(Boolean);
    for (const term of terms) {
      const t = ` ${term.replace(/[^a-z0-9]+/g, ' ').trim()} `;
      if (t.trim() && text.includes(t) && (!best || t.length > best.len)) best = { area, len: t.length };
    }
  }
  return best?.area || null;
}

/** Logística determinística. `routing` = { distanceKm, travelMinutes } (rodoviário) ou null. */
export function computeLogistics({ area, rules = {}, routing = null, musicians = 0 }) {
  const items = [];
  const unresolved = [];
  const approvals = [];
  if (area?.status === 'blocked') return { blocked: true, items, unresolved, approvals, total: 0 };
  if (area?.status === 'conditional') approvals.push('territory_conditional');

  const distanceKm = Number(routing?.distanceKm ?? area?.distance_km);
  const hasDistance = Number.isFinite(distanceKm) && distanceKm >= 0;

  if (area && (area.travel_fee != null || area.toll_fee != null || area.lodging_fee != null)) {
    if (Number(area.travel_fee) > 0) items.push({ key: 'travel', label: 'Deslocamento', amount: money(area.travel_fee) });
    if (Number(area.toll_fee) > 0) items.push({ key: 'toll', label: 'Pedágios', amount: money(area.toll_fee) });
    if (area.lodging_required) {
      if (Number(area.lodging_fee) > 0) items.push({ key: 'lodging', label: 'Hospedagem', amount: money(area.lodging_fee) });
      else unresolved.push('lodging_fee_missing');
    }
  } else if (Number(rules.per_km_rate) > 0 && hasDistance) {
    const free = Number(rules.free_radius_km) || 0;
    const billableKm = Math.max(0, distanceKm - free);
    // Ida e volta.
    if (billableKm > 0) items.push({ key: 'travel', label: 'Deslocamento', amount: money(billableKm * 2 * Number(rules.per_km_rate)) });
    if (Number(rules.toll_per_km) > 0 && billableKm > 0) items.push({ key: 'toll', label: 'Pedágios', amount: money(billableKm * 2 * Number(rules.toll_per_km)) });
    const lodgingOver = Number(rules.lodging_over_km);
    if (Number.isFinite(lodgingOver) && lodgingOver > 0 && distanceKm > lodgingOver) {
      if (Number(rules.lodging_fee_per_musician) > 0 && musicians > 0) {
        items.push({ key: 'lodging', label: 'Hospedagem', amount: money(Number(rules.lodging_fee_per_musician) * musicians) });
      } else unresolved.push('lodging_fee_missing');
    }
  } else if (area?.status === 'served') {
    // Área atendida sem taxa cadastrada = região base (sem custo de logística).
  } else {
    // Local não cadastrado/condicional sem taxa e sem regra de km: não dá para cotar.
    unresolved.push('logistics_unresolved');
  }
  return { blocked: false, items, unresolved, approvals, total: money(items.reduce((s, i) => s + i.amount, 0)), distanceKm: hasDistance ? distanceKm : null };
}

/**
 * Cálculo puro. input: { date, formation, instruments, hasSound, reception: { formation, hours }, location }
 * tables: { rules, pricing, areas, logisticsRules, minMarginPct }, routing opcional.
 */
export function calculateQuote(input = {}, tables = {}, routing = null) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(input.date || '')) ? input.date : null;
  const unresolved = [];
  const approvals = [];
  const items = [];
  const sources = {};
  const formation = normalizeFormation(input.formation);
  const size = FORMATION_SIZE[formation] || 0;
  if (!date) unresolved.push('date_missing');
  if (!size) unresolved.push('formation_invalid');
  const instruments = parseInstruments(input.instruments);
  if (size && instruments.length && instruments.length !== size) approvals.push('instruments_mismatch');

  const rules = tables.rules || [];
  const pricing = tables.pricing || null;
  const refDate = date || new Date().toISOString().slice(0, 10);
  const fslug = slug(formation);

  // Cerimônia
  if (size) {
    let base = pickRule(rules, 'ceremony', fslug, refDate);
    sources.ceremony = base ? 'quote_price_rules' : null;
    if (!base && pricing) { base = getAutomaticFormationPrice(formation, pricing) || null; sources.ceremony = base ? 'pricing_settings' : null; }
    if (base) items.push({ key: 'ceremony', label: `Cerimônia — ${formation}`, amount: money(base) });
    else unresolved.push('ceremony_price_missing');
  }

  // Receptivo
  const rHours = Math.max(0, Math.min(3, parseInt(input.reception?.hours, 10) || 0));
  const rFormation = rHours ? normalizeFormation(input.reception?.formation || formation) : '';
  const rSize = FORMATION_SIZE[rFormation] || 0;
  if (rHours) {
    let rec = pickRule(rules, 'reception', `${slug(rFormation)}_${rHours}h`, refDate);
    sources.reception = rec ? 'quote_price_rules' : null;
    if (!rec && pricing) { rec = getAutomaticReceptionPrice(rFormation, rHours, pricing) || null; sources.reception = rec ? 'pricing_settings' : null; }
    if (rec) items.push({ key: 'reception', label: `Receptivo — ${rFormation} (${rHours}h)`, amount: money(rec) });
    else unresolved.push('reception_price_missing');
  }

  // Sonorização
  if (input.hasSound) {
    let sound = pickRule(rules, 'sound', rHours ? 'church_reception' : 'church', refDate);
    sources.sound = sound ? 'quote_price_rules' : null;
    if (!sound && pricing && Number(pricing.sound_price) > 0) { sound = Number(pricing.sound_price); sources.sound = 'pricing_settings'; }
    if (sound) items.push({ key: 'sound', label: 'Sonorização', amount: money(sound) });
    else unresolved.push('sound_price_missing');
  }

  // Território e logística
  const area = resolveTerritory(tables.areas, input.location);
  if (!input.location) unresolved.push('location_missing');
  const logistics = input.location
    ? computeLogistics({ area, rules: tables.logisticsRules || {}, routing, musicians: Math.max(size, rSize) })
    : { blocked: false, items: [], unresolved: [], approvals: [], total: 0 };
  if (logistics.blocked) {
    return { ok: false, blocked: true, reason: 'territory_blocked', territory: area ? { name: area.name, status: area.status } : null };
  }
  items.push(...logistics.items);
  unresolved.push(...logistics.unresolved);
  approvals.push(...logistics.approvals);

  const total = money(items.reduce((s, i) => s + i.amount, 0));

  // Margem (somente com cachês oficiais cadastrados)
  let margin = null;
  const outside = Number(logistics.distanceKm) > (Number(tables.logisticsRules?.free_radius_km) || 35);
  const unitFee = pickRule(rules, 'musician_fee', outside ? 'outside_base' : (rHours ? 'reception_local' : 'ceremony_local'), refDate);
  if (unitFee && size) {
    const cost = money(unitFee * Math.max(size, rSize) + logistics.total);
    margin = total > 0 ? money(((total - cost) / total) * 100) : null;
    const min = Number(tables.minMarginPct);
    if (Number.isFinite(min) && min > 0 && margin !== null && margin < min) approvals.push('margin_below_minimum');
  }

  return {
    ok: true,
    final: unresolved.length === 0 && approvals.length === 0,
    date, formation, instruments, hasSound: Boolean(input.hasSound),
    reception: rHours ? { formation: rFormation, hours: rHours, instruments: parseInstruments(input.reception?.instruments) } : null,
    items, total, margin, sources,
    territory: area ? { name: area.name, status: area.status } : null,
    unresolved: [...new Set(unresolved)],
    approvals: [...new Set(approvals)],
  };
}

/** Carrega tabelas oficiais do workspace e calcula. `routeFn(location)` opcional (rodoviário). */
export async function quoteForWorkspace({ supabase, workspaceId, input, settings = null, routeFn = null }) {
  const [rulesRes, pricingRes, areasRes] = await Promise.all([
    supabase.from('quote_price_rules').select('category, item_key, amount, valid_from, valid_until').eq('workspace_id', workspaceId),
    supabase.from('pricing_settings').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    supabase.from('ai_service_areas').select('*').eq('workspace_id', workspaceId),
  ]);
  const tables = {
    rules: rulesRes.data || [],
    pricing: pricingRes.data || null,
    areas: areasRes.data || [],
    logisticsRules: settings?.logistics_rules || {},
    minMarginPct: settings?.min_margin_pct ?? null,
  };
  let routing = null;
  const area = resolveTerritory(tables.areas, input?.location);
  if (routeFn && input?.location && !(area && area.travel_fee != null)) {
    try { routing = await routeFn(input.location, tables.logisticsRules.origin); } catch { routing = null; }
  }
  return calculateQuote(input, tables, routing);
}

export function formatBRL(value) {
  const n = Number(value) || 0;
  const [int, dec] = n.toFixed(2).split('.');
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}
