/**
 * Fechamento autônomo até o pré-contrato:
 *  1) resumo obrigatório (data, formação, instrumentos/músicos, som, receptivo, total) com hash;
 *  2) confirmação EXPRESSA; qualquer outra resposta invalida o resumo;
 *  3) revalidação de preço e agenda no momento da confirmação;
 *  4) cria/reutiliza orçamento + pré-contrato nativos (somente data, formação, instrumentistas,
 *     valores, som e receptivo; dados pessoais o cliente preenche no link);
 *  5) envia o link individual. Idempotente; contratos assinados nunca são alterados.
 */
import { sha256Hex } from '../inbox/meta-webhook.mjs';
import { formatBRL } from './pricing.mjs';

const SIGNED = new Set(['signed', 'assinado']);
const FINAL = new Set(['signed', 'assinado', 'cancelled', 'canceled', 'archived', 'arquivado', 'expired']);

function formatDateBR(iso) {
  const [y, m, d] = String(iso || '').split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(iso || '');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  return value;
}

export async function hashSummary(summary) {
  return sha256Hex(JSON.stringify(canonical(summary)));
}

/** Resumo estruturado a partir de um orçamento determinístico final. */
export function buildClosingSummary(quote, { time = null, location = null, musicians = [] } = {}) {
  return {
    date: quote.date,
    time: time || null,
    location: location || null,
    ceremony: { formation: quote.formation, instruments: quote.instruments },
    musicians: musicians.map((m) => ({ role: m.role || null, name: m.name })),
    sound: Boolean(quote.hasSound),
    reception: quote.reception
      ? { formation: quote.reception.formation, instruments: quote.reception.instruments, hours: quote.reception.hours }
      : null,
    items: quote.items.map((i) => ({ key: i.key, label: i.label, amount: i.amount })),
    total: quote.total,
  };
}

export function renderSummaryText(summary) {
  const lines = [
    'Perfeito! Antes de gerar seu pré-contrato, confira o resumo:',
    '',
    `📅 Data: ${formatDateBR(summary.date)}${summary.time ? ` às ${summary.time}` : ''}`,
    `🎻 Cerimônia: ${summary.ceremony.formation}${summary.ceremony.instruments?.length ? ` — ${summary.ceremony.instruments.join(', ')}` : ''}`,
  ];
  if (summary.musicians?.length) lines.push(`🎤 Músicos: ${summary.musicians.map((m) => (m.role ? `${m.role}: ${m.name}` : m.name)).join('; ')}`);
  lines.push(`🔊 Sonorização: ${summary.sound ? 'incluída' : 'não incluída'}`);
  lines.push(summary.reception
    ? `🥂 Receptivo: ${summary.reception.formation}${summary.reception.instruments?.length ? ` (${summary.reception.instruments.join(', ')})` : ''} — ${summary.reception.hours}h`
    : '🥂 Receptivo: não incluído');
  lines.push(`💰 Valor total: ${formatBRL(summary.total)}`);
  lines.push('', 'Está tudo certo? Responda *CONFIRMO* para eu gerar seu pré-contrato. Se quiser ajustar algo, é só me dizer 😊');
  return lines.join('\n');
}

const CONFIRM_PHRASES = [
  'confirmo', 'confirmado', 'confirmada', 'sim confirmo', 'sim', 'sim pode gerar', 'pode gerar', 'pode seguir',
  'pode mandar', 'pode enviar', 'tudo certo', 'esta tudo certo', 'ta tudo certo', 'ta certo', 'certinho',
  'isso mesmo', 'correto', 'perfeito', 'tudo certo pode gerar', 'perfeito pode gerar', 'sim tudo certo',
  'confirmo pode gerar', 'sim confirmado', 'ok confirmo', 'confirmadissimo',
];
const CORRECTION_CUES = /\b(mas|porem|so que|trocar|mudar|alterar|corrig|errad|nao|sem|em vez|ao inves|outra|outro)\b|\d/;

/** 'confirm' somente para confirmação expressa e curta, sem sinal de correção. */
export function classifyConfirmation(text) {
  const t = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t.split(' ').length > 6) return 'other';
  if (CORRECTION_CUES.test(t)) return 'other';
  return CONFIRM_PHRASES.includes(t) ? 'confirm' : 'other';
}

function contractToken() {
  return Date.now().toString(36) + crypto.randomUUID().replaceAll('-', '').slice(0, 10);
}

export function appBaseUrl(env = process.env) {
  return String(env.NEXT_PUBLIC_APP_URL || env.APP_BASE_URL || 'https://app.bandaharmonics.com').replace(/\/+$/, '');
}

/**
 * Cria ou reutiliza orçamento + pré-contrato. Reutiliza o pré-contrato da conversa se ainda
 * editável; se estiver assinado/finalizado, NÃO altera e pede humano.
 */
export async function upsertPrecontract({ supabase, workspaceId, conversation, summary, env = process.env }) {
  const fields = {
    event_date: summary.date,
    event_time: summary.time || null,
    formation: summary.ceremony.formation,
    instruments: (summary.ceremony.instruments || []).join(', ') || null,
    has_sound: summary.sound,
    reception_hours: summary.reception?.hours || 0,
    reception_formation: summary.reception?.formation || null,
    reception_instruments: (summary.reception?.instruments || []).join(', ') || null,
    base_amount: summary.items.find((i) => i.key === 'ceremony')?.amount || 0,
    add_reception: summary.items.find((i) => i.key === 'reception')?.amount || 0,
    add_sound: summary.items.find((i) => i.key === 'sound')?.amount || 0,
    add_transport: summary.items.filter((i) => ['travel', 'toll', 'lodging'].includes(i.key)).reduce((s, i) => s + i.amount, 0),
    agreed_amount: summary.total,
  };
  fields.has_transport = fields.add_transport > 0;

  if (conversation.precontract_id) {
    const { data: existing } = await supabase.from('precontracts').select('id, status, public_token, generated_link')
      .eq('id', conversation.precontract_id).eq('workspace_id', workspaceId).maybeSingle();
    if (existing) {
      const { data: signed } = await supabase.from('contracts').select('status, signed_at')
        .eq('precontract_id', existing.id).eq('workspace_id', workspaceId).maybeSingle();
      if (SIGNED.has(String(existing.status)) || signed?.status === 'signed' || signed?.signed_at) {
        return { ok: false, reason: 'precontract_signed' };
      }
      if (!FINAL.has(String(existing.status))) {
        const { error } = await supabase.from('precontracts').update({ ...fields, updated_at: new Date().toISOString() })
          .eq('id', existing.id).eq('workspace_id', workspaceId);
        if (error) return { ok: false, reason: 'precontract_update_failed' };
        return { ok: true, reused: true, precontractId: existing.id, link: existing.generated_link };
      }
    }
  }

  const token = contractToken();
  const link = `${appBaseUrl(env)}/contrato/${token}`;
  const { data: quote } = await supabase.from('quotes').insert({
    workspace_id: workspaceId, status: 'approved', event_date: fields.event_date, event_time: fields.event_time,
    formation: fields.formation, instruments: fields.instruments, reception_hours: fields.reception_hours,
    reception_formation: fields.reception_formation, has_sound: fields.has_sound, base_amount: fields.base_amount,
    reception_amount: fields.add_reception, sound_amount: fields.add_sound, logistics_amount: fields.add_transport,
    suggested_amount: summary.total, agreed_amount: summary.total, approved_at: new Date().toISOString(),
    notes: 'Gerado pelo fechamento do Inbox (IA) após confirmação expressa do cliente.',
  }).select('id').maybeSingle();
  const { data: pc, error } = await supabase.from('precontracts').insert({
    workspace_id: workspaceId, ...fields, status: 'link_generated', public_token: token, generated_link: link,
    notes: 'Pré-contrato gerado pelo Inbox (IA). Dados pessoais preenchidos pelo cliente no link.',
  }).select('id, generated_link').maybeSingle();
  if (error || !pc) return { ok: false, reason: 'precontract_insert_failed' };
  if (quote?.id) await supabase.from('quotes').update({ precontract_id: pc.id }).eq('id', quote.id).eq('workspace_id', workspaceId);
  await supabase.from('ai_conversations').update({ precontract_id: pc.id, quote_id: quote?.id || null, deal_value: summary.total })
    .eq('id', conversation.id).eq('workspace_id', workspaceId);
  return { ok: true, reused: false, precontractId: pc.id, quoteId: quote?.id || null, link: pc.generated_link };
}

export function linkMessage(link) {
  return `Prontinho! 🎉 Seu pré-contrato está aqui: ${link}\n\nNo link você preenche seus dados pessoais e o endereço do evento. Qualquer dúvida, é só me chamar por aqui.`;
}
