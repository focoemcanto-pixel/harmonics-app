/**
 * Precificação determinística da IA comercial. Nunca inventa valores:
 *  - Fonte 1: quote_price_rules vigentes na data (mesmas categorias do módulo Orçamentos:
 *    ceremony/<formação>, reception/<formação>_<h>h, sound/church|church_reception_<h>h (ver
 *    lib/quotes/sound-rules.mjs),
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
import { resolveSoundPricing, hasDurationSoundRules } from '../../quotes/sound-rules.mjs';
import { otherStateIn, knownTravelMinutes, CUSTOM_TRIP_MINUTES } from './geo.mjs';

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

  // Território primeiro: a faixa de preço (Manual §4) depende da região do evento.
  const area = resolveTerritory(tables.areas, input.location);
  const tier = area?.price_tier && area.price_tier !== 'base' ? area.price_tier : null;
  // Nunca aplicar o preço da região-base a outra região (Manual §4): faixa sem regra própria não cai na base,
  // e local informado sem área cadastrada fica sem preço musical até o Owner parametrizar.
  const tierRule = (category, key) => (tier ? pickRule(rules, category, `${key}@${tier}`, refDate) : pickRule(rules, category, key, refDate));
  // Outro estado (sem localidade cadastrada) ou viagem real acima de 2h30: orçamento personalizado, sem valores
  // de tabela, sujeito à aprovação do Owner (Manual §5). Nada é classificado pelo nome da cidade/distância aproximada.
  const otherState = Boolean(input.location) && !area && Boolean(otherStateIn(input.location));
  const minutes = knownTravelMinutes({ area, routing });
  const customLimit = Number(tables.logisticsRules?.custom_over_minutes) > 0 ? Number(tables.logisticsRules.custom_over_minutes) : CUSTOM_TRIP_MINUTES;
  const longTrip = minutes != null && minutes > customLimit;
  if (otherState) approvals.push('other_state_custom');
  if (longTrip) approvals.push('long_trip_custom');
  const regionUnknown = (Boolean(input.location) && !area) || longTrip;
  if (regionUnknown && !otherState && !longTrip) approvals.push('region_not_parameterized');
  const modality = input.modality === 'show' ? 'show' : 'ceremony';

  if (regionUnknown) {
    unresolved.push('region_price_missing');
  } else if (modality === 'show') {
    // Apresentação avulsa por tempo (Manual §8): tabela própria, sem tabela de receptivo adicional.
    const hours = Math.max(0, Math.min(3, parseInt(input.hours ?? input.show?.hours, 10) || 0));
    if (!hours) unresolved.push('show_hours_missing');
    if (size && hours) {
      // Categoria oficial 'other' com prefixo show: (sem alterar o schema de quote_price_rules).
      const price = tierRule('other', `show:${fslug}_${hours}h`);
      sources.show = price ? 'quote_price_rules' : null;
      if (price) items.push({ key: 'show', label: `Apresentação por tempo — ${formation} (${hours}h)`, amount: money(price) });
      else unresolved.push('show_price_missing');
    }
    if (Number(input.reception?.hours) > 0) approvals.push('reception_requires_ceremony');
  } else if (size) {
    let base = tierRule('ceremony', fslug);
    sources.ceremony = base ? 'quote_price_rules' : null;
    if (!base && pricing && !tier) { base = getAutomaticFormationPrice(formation, pricing) || null; sources.ceremony = base ? 'pricing_settings' : null; }
    if (base) items.push({ key: 'ceremony', label: `Cerimônia — ${formation}`, amount: money(base) });
    else unresolved.push('ceremony_price_missing');
    if (!base && tier) approvals.push('region_price_missing');
  }

  // Receptivo ADICIONAL: só junto com cerimônia (Manual §7).
  const rHours = modality === 'ceremony' ? Math.max(0, Math.min(3, parseInt(input.reception?.hours, 10) || 0)) : 0;
  const rFormation = rHours ? normalizeFormation(input.reception?.formation || formation) : '';
  const rSize = FORMATION_SIZE[rFormation] || 0;
  if (rHours && !regionUnknown) {
    let rec = tierRule('reception', `${slug(rFormation)}_${rHours}h`);
    sources.reception = rec ? 'quote_price_rules' : null;
    if (!rec && tier) approvals.push('region_price_missing');
    if (!rec && pricing && !tier) { rec = getAutomaticReceptionPrice(rFormation, rHours, pricing) || null; sources.reception = rec ? 'pricing_settings' : null; }
    if (rec) items.push({ key: 'reception', label: `Receptivo — ${rFormation} (${rHours}h)`, amount: money(rec) });
    else unresolved.push('reception_price_missing');
  }

  // Sonorização: referência só para cerimônia (Manual §6); por tempo/eventos especiais = sob medida.
  let soundInfo = null;
  if (input.hasSound) {
    if (modality === 'show') unresolved.push('sound_custom');
    else {
      const soundPlan = resolveSoundPricing({
        receptionHours: rHours,
        pick: (category, key) => pickRule(rules, category, key, refDate),
        hasDurationRules: hasDurationSoundRules(rules, (r) => ruleValid(r, refDate)),
      });
      soundInfo = soundPlan;
      let sound = soundPlan.amount;
      sources.sound = sound ? 'quote_price_rules' : null;
      if (soundPlan.requiresValidation) approvals.push('sound_duration_requires_validation');
      else {
        // pricing_settings só serve de reserva para cerimônia sem receptivo (como antes).
        if (!sound && (!rHours || soundPlan.legacy) && pricing && Number(pricing.sound_price) > 0) { sound = Number(pricing.sound_price); sources.sound = 'pricing_settings'; }
        if (sound) items.push({ key: 'sound', label: 'Sonorização', amount: money(sound) });
        else unresolved.push('sound_price_missing');
        if (soundPlan.marginBelowMinimum) approvals.push('sound_margin_below_minimum');
      }
    }
  }

  // Logística
  if (!input.location) unresolved.push('location_missing');
  const logistics = input.location
    ? computeLogistics({ area, rules: tables.logisticsRules || {}, routing, musicians: Math.max(size, rSize) })
    : { blocked: false, items: [], unresolved: [], approvals: [], total: 0 };
  if (logistics.blocked) {
    return { ok: false, blocked: true, reason: 'territory_blocked', territory: area ? { name: area.name, status: area.status } : null };
  }
  // Faixas fora da região-base sem taxa cadastrada na área: deslocamento padrão da banda (regra oficial).
  if (tier && area && area.travel_fee == null && !logistics.items.some((i) => i.key === 'travel')) {
    // band_trip (Manual) ou standard_trip (chave usada pelo módulo Orçamentos): mesma regra, sem duplicar.
    const band = pickRule(rules, 'transport', 'band_trip', refDate) ?? pickRule(rules, 'transport', 'standard_trip', refDate);
    if (band) { logistics.items.push({ key: 'travel', label: 'Deslocamento da banda', amount: money(band) }); logistics.unresolved = logistics.unresolved.filter((u) => u !== 'logistics_unresolved'); }
  }
  // Equipe de som com transporte próprio (só se houver som e não estiver incluso).
  if (input.hasSound && modality === 'ceremony' && area && (tier || Number(area.sound_travel_fee) > 0)) {
    const soundTrip = Number(area.sound_travel_fee) > 0 ? Number(area.sound_travel_fee) : pickRule(rules, 'transport', 'sound_trip', refDate);
    if (soundTrip) logistics.items.push({ key: 'sound_travel', label: 'Deslocamento da equipe de som', amount: money(soundTrip) });
  }
  logistics.total = money(logistics.items.reduce((sum, i) => sum + i.amount, 0));
  items.push(...logistics.items);
  unresolved.push(...logistics.unresolved);
  approvals.push(...logistics.approvals);

  const total = money(items.reduce((sum, i) => sum + i.amount, 0));

  // Resultado interno (Manual §9) — nunca exposto ao cliente.
  const cost = estimateInternalCost({ rules, refDate, size, instruments, rSize, rHours, outside: Boolean(tier) || Number(logistics.distanceKm) > (Number(tables.logisticsRules?.free_radius_km) || 35), primaryVocalSings: input.primaryVocalSings !== false, logisticsTotal: logistics.total, soundTechCost: soundInfo?.techCost || 0 });
  let margin = null;
  if (cost) {
    margin = total > 0 ? money(((total - cost.total) / total) * 100) : null;
    const min = Number(tables.minMarginPct);
    if (Number.isFinite(min) && min > 0 && margin !== null && margin < min) approvals.push('margin_below_minimum');
  }

  return {
    ok: true,
    final: unresolved.length === 0 && approvals.length === 0,
    date, formation, instruments, hasSound: Boolean(input.hasSound), modality, tier: tier || (area ? 'base' : null),
    hours: modality === 'show' ? Math.max(0, Math.min(3, parseInt(input.hours ?? input.show?.hours, 10) || 0)) : null,
    reception: rHours ? { formation: rFormation, hours: rHours, instruments: parseInstruments(input.reception?.instruments) } : null,
    items, total, margin, internalCost: cost, sources,
    territory: area ? { name: area.name, status: area.status, tier: area.price_tier || null } : null,
    unresolved: [...new Set(unresolved)],
    approvals: [...new Set(approvals)],
  };
}

/**
 * Custo interno dos músicos (Manual §9): quando o vocalista principal canta, não há cachê dele
 * (o resultado residual é da empresa); tecladista tem cachê próprio; extra por hora de receptivo
 * para músicos contratados que continuam. Retorna null sem cachês oficiais cadastrados.
 */
export function estimateInternalCost({ rules, refDate, size, instruments = [], rSize = 0, rHours = 0, outside = false, primaryVocalSings = true, logisticsTotal = 0, soundTechCost = 0 }) {
  const fee = (keys) => keys.map((k) => pickRule(rules, 'musician_fee', k, refDate)).find((v) => v != null) ?? null;
  const musician = outside ? fee(['musician_outside', 'outside_base']) : fee(['musician_local', rHours ? 'reception_local' : 'ceremony_local', 'ceremony_local']);
  if (!musician || !size) return null;
  const keyboard = (outside ? fee(['keyboard_outside']) : fee(['keyboard_local'])) ?? musician;
  const extraHour = fee(['reception_extra_hour']) ?? 0;
  const list = instruments.length === size ? instruments : Array.from({ length: size }, (_, i) => instruments[i] || 'músico');
  let ceremony = 0;
  let paidMusicians = 0;
  let vocalExcluded = false;
  for (const inst of list) {
    if (/voz|vocal|cantor|cantora/i.test(inst) && primaryVocalSings && !vocalExcluded) { vocalExcluded = true; continue; }
    ceremony += /teclad|piano/i.test(inst) ? keyboard : musician;
    paidMusicians += 1;
  }
  const continuing = Math.min(rSize, size) - (vocalExcluded && rSize > 0 ? 1 : 0);
  const reception = rHours ? Math.max(0, continuing) * rHours * extraHour + Math.max(0, rSize - size) * musician : 0;
  const tech = money(soundTechCost);
  return {
    musicians: money(ceremony + reception), logistics: money(logisticsTotal), soundTech: tech, total: money(ceremony + reception + logisticsTotal + tech),
    paidMusicians, primaryVocalExcluded: vocalExcluded, receptionExtras: money(reception),
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

/** Pendências de parametrização regional: sem elas o orçamento não mostra valores musicais. */
export const CUSTOM_QUOTE_ISSUES = Object.freeze(['other_state_custom', 'long_trip_custom']);
export const REGION_ISSUES = Object.freeze(['region_not_parameterized', 'region_price_missing', ...CUSTOM_QUOTE_ISSUES]);
const TABLE_BLOCKING = ['region_not_parameterized', ...CUSTOM_QUOTE_ISSUES];
export const hasRegionIssue = (quote, { tableMode = false } = {}) => (quote?.approvals || [])
  .some((a) => (tableMode ? TABLE_BLOCKING.includes(a) : REGION_ISSUES.includes(a)));
export const isCustomQuote = (quote) => (quote?.approvals || []).some((a) => CUSTOM_QUOTE_ISSUES.includes(a));

/** Sinaliza ao Owner (uma vez por conversa e local) que falta parametrizar preços da localidade. */
export async function flagRegionPricing({ supabase, workspaceId, conversationId, location, date, reason }) {
  if (!conversationId) return { ok: false };
  const summary = `Parametrizar preços/faixa para a localidade "${String(location || '').slice(0, 80)}"`;
  const { data: existing } = await supabase.from('ai_approvals').select('id')
    .eq('workspace_id', workspaceId).eq('conversation_id', conversationId).eq('status', 'pending').eq('summary', summary).limit(1);
  if ((existing || []).length) return { ok: true, registrado: true, receipt: existing[0].id };
  const { error } = await supabase.from('ai_approvals').insert({
    workspace_id: workspaceId, conversation_id: conversationId, kind: 'pricing_exception', summary,
    details: { region_parameterization: true, location: location || null, date: date || null, reason: reason || null },
  });
  return { ok: !error, registrado: !error };
}

