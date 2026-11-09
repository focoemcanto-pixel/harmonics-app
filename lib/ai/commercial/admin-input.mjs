/** Validação (pura) das entradas do painel de Inteligência Comercial. */
import { slugKey } from './knowledge.mjs';

const KINDS = ['rule', 'faq', 'policy', 'rider', 'example', 'style', 'response', 'post_sale'];
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v, max = 12) => (Array.isArray(v) ? v : String(v || '').split(','))
  .map((x) => String(x).trim().toLowerCase()).filter(Boolean).slice(0, max);
const num = (v) => (v === '' || v === null || v === undefined ? null : (Number.isFinite(Number(v)) ? Number(v) : null));

export function parseKnowledgeInput(body = {}) {
  const kind = KINDS.includes(body.kind) ? body.kind : null;
  const title = text(body.title, 160);
  const content = text(body.content, 4000);
  if (!kind || !title || !content) return { error: 'Tipo, título e conteúdo são obrigatórios.' };
  const metadata = {};
  if (kind === 'rider') {
    if (body.formation) metadata.formation = text(body.formation, 30).toLowerCase();
    if (['cerimonia', 'receptivo'].includes(body.service)) metadata.service = body.service;
  }
  return {
    item_key: text(body.item_key, 60) || slugKey(`${kind}-${title}`),
    kind, title, content,
    intents: list(body.intents), keywords: list(body.keywords, 20), metadata,
    priority: Math.max(0, Math.min(100, Math.round(num(body.priority) ?? 50))),
  };
}

export function parseServiceAreaInput(body = {}) {
  const name = text(body.name, 120);
  if (!name) return { error: 'Nome da localidade obrigatório.' };
  const status = ['served', 'conditional', 'blocked'].includes(body.status) ? body.status : 'served';
  return {
    name, status, match_terms: list(body.match_terms, 30),
    distance_km: num(body.distance_km), travel_minutes: num(body.travel_minutes) === null ? null : Math.round(num(body.travel_minutes)),
    travel_fee: num(body.travel_fee), toll_fee: num(body.toll_fee), lodging_required: Boolean(body.lodging_required),
    lodging_fee: num(body.lodging_fee), extra_setup_minutes: num(body.extra_setup_minutes) === null ? null : Math.round(num(body.extra_setup_minutes)),
    notes: text(body.notes, 500) || null, active: body.active !== false,
    price_tier: ['base', 'metro', 'ate120', 'custom'].includes(body.price_tier) ? body.price_tier : null,
    sound_travel_fee: num(body.sound_travel_fee),
  };
}

export function parseMusicianInput(body = {}) {
  const contactId = text(body.contact_id, 64);
  const name = text(body.display_name, 120);
  if (!contactId || !name) return { error: 'Contato e nome são obrigatórios.' };
  const urls = list(body.video_urls, 6).filter((u) => /^https:\/\//.test(u));
  return {
    contact_id: contactId, display_name: name, instruments: list(body.instruments), roles: list(body.roles),
    is_primary_vocal: Boolean(body.is_primary_vocal), fee: num(body.fee), video_urls: urls,
    portfolio_url: /^https:\/\//.test(text(body.portfolio_url, 300)) ? text(body.portfolio_url, 300) : null,
    active: body.active !== false, notes: text(body.notes, 500) || null,
    // Vocalistas: voz e autorização explícita para apresentar à cliente, com links individuais.
    voice: ['masculino', 'feminino'].includes(body.voice) ? body.voice : null,
    client_presentable: body.client_presentable === true,
    presentation_urls: list(body.presentation_urls, 6).filter((u) => /^https:\/\//.test(u)),
  };
}
