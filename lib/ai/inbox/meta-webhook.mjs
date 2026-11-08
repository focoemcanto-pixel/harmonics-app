/**
 * WhatsApp Cloud API (Meta) — verificação e normalização de webhooks.
 * Puro: sem banco e sem rede. Compatível com Workers (WebCrypto).
 *
 * Campos tratados (assinar no app Meta): messages, smb_message_echoes (Coexistence:
 * mensagens enviadas pelo app WhatsApp Business), history (sincronização de histórico da
 * Coexistence) e smb_app_state_sync (contatos do app).
 */

const encoder = new TextEncoder();

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqualHex(a, b, { caseInsensitive = false } = {}) {
  const left = caseInsensitive ? String(a || '').toLowerCase() : String(a || '');
  const right = caseInsensitive ? String(b || '').toLowerCase() : String(b || '');
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export async function hmacSha256Hex(secret, body) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
}

export async function sha256Hex(text) {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

/** Falha fechada: sem META_APP_SECRET nenhum POST é aceito. */
export async function verifyMetaSignature({ rawBody, signatureHeader, appSecret }) {
  const secret = String(appSecret || '').trim();
  if (!secret) return { ok: false, status: 503, reason: 'app_secret_not_configured' };
  const header = String(signatureHeader || '').trim();
  if (!header.startsWith('sha256=')) return { ok: false, status: 401, reason: 'missing_signature' };
  const expected = await hmacSha256Hex(secret, rawBody);
  if (!timingSafeEqualHex(header.slice(7), expected, { caseInsensitive: true })) return { ok: false, status: 401, reason: 'invalid_signature' };
  return { ok: true };
}

/** Desafio GET de verificação do webhook. */
export function verifyMetaChallenge(searchParams, verifyToken) {
  const expected = String(verifyToken || '').trim();
  const mode = searchParams.get('hub.mode');
  const token = String(searchParams.get('hub.verify_token') || '');
  const challenge = searchParams.get('hub.challenge');
  if (!expected) return { ok: false, status: 503 };
  if (mode !== 'subscribe' || !challenge || !timingSafeEqualHex(token, expected)) {
    return { ok: false, status: 403 };
  }
  return { ok: true, challenge: String(challenge) };
}

export function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function toDate(ts) {
  const n = Number(ts);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
}

/** Extrai texto/mídia de uma mensagem Cloud API. */
export function extractMessageContent(message = {}) {
  const type = String(message.type || 'unknown');
  switch (type) {
    case 'text':
      return { type, content: message.text?.body || '' };
    case 'audio':
      return { type, content: '', mediaId: message.audio?.id || null, mediaMime: message.audio?.mime_type || null, voice: Boolean(message.audio?.voice) };
    case 'image':
    case 'video':
    case 'document':
    case 'sticker': {
      const media = message[type] || {};
      return { type, content: media.caption || media.filename || '', mediaId: media.id || null, mediaMime: media.mime_type || null };
    }
    case 'button':
      return { type: 'text', content: message.button?.text || message.button?.payload || '' };
    case 'interactive': {
      const reply = message.interactive?.button_reply || message.interactive?.list_reply || {};
      return { type: 'text', content: reply.title || reply.description || '' };
    }
    case 'location': {
      const loc = message.location || {};
      return { type, content: [loc.name, loc.address].filter(Boolean).join(' — ') || `Localização (${loc.latitude}, ${loc.longitude})` };
    }
    case 'reaction':
      return { type, content: message.reaction?.emoji || '', ignore: true };
    default:
      return { type, content: '' };
  }
}

/**
 * Normaliza o payload em eventos independentes do provedor:
 *  - { kind:'message', origin:'customer'|'business_app'|'history', direction, chatId, ... }
 *  - { kind:'status', providerMessageId, status, errorCode }
 *  - { kind:'contact', chatId, name }
 *  - { kind:'history_progress', phase, progress, error }
 */
export function parseMetaWebhook(payload) {
  const events = [];
  if (!payload || payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return events;

  for (const entry of payload.entry) {
    for (const change of entry?.changes || []) {
      const field = change?.field;
      const value = change?.value || {};
      const phoneNumberId = String(value?.metadata?.phone_number_id || '');
      const businessPhone = normalizePhone(value?.metadata?.display_phone_number);
      if (!phoneNumberId) continue;
      const base = { phoneNumberId, wabaId: entry?.id ? String(entry.id) : null };

      if (field === 'messages') {
        const names = new Map((value.contacts || []).map((c) => [normalizePhone(c?.wa_id), c?.profile?.name || null]));
        for (const message of value.messages || []) {
          const chatId = normalizePhone(message?.from);
          const content = extractMessageContent(message);
          if (!chatId || !message?.id || content.ignore) continue;
          events.push({
            ...base, kind: 'message', origin: 'customer', direction: 'inbound', chatId,
            providerMessageId: String(message.id), messageType: content.type, content: content.content,
            mediaId: content.mediaId || null, mediaMime: content.mediaMime || null,
            createdAt: toDate(message.timestamp), contactName: names.get(chatId) || null,
          });
        }
        for (const status of value.statuses || []) {
          if (!status?.id || !status?.status) continue;
          events.push({
            ...base, kind: 'status', providerMessageId: String(status.id), status: String(status.status),
            chatId: normalizePhone(status.recipient_id), errorCode: status.errors?.[0]?.code ? String(status.errors[0].code) : null,
          });
        }
      } else if (field === 'smb_message_echoes') {
        for (const echo of value.message_echoes || []) {
          const chatId = normalizePhone(echo?.to);
          const content = extractMessageContent(echo);
          if (!chatId || !echo?.id || content.ignore) continue;
          events.push({
            ...base, kind: 'message', origin: 'business_app', direction: 'outbound', chatId,
            providerMessageId: String(echo.id), messageType: content.type, content: content.content,
            mediaId: content.mediaId || null, mediaMime: content.mediaMime || null, createdAt: toDate(echo.timestamp),
          });
        }
      } else if (field === 'history') {
        for (const chunk of value.history || []) {
          if (chunk?.errors?.length) {
            events.push({ ...base, kind: 'history_progress', error: String(chunk.errors[0]?.code || 'error') });
            continue;
          }
          const meta = chunk?.metadata || {};
          events.push({ ...base, kind: 'history_progress', phase: meta.phase ?? null, progress: meta.progress ?? null });
          for (const thread of chunk?.threads || []) {
            const chatId = normalizePhone(thread?.id);
            for (const message of thread?.messages || []) {
              const content = extractMessageContent(message);
              if (!chatId || !message?.id || content.ignore) continue;
              const fromBusiness = businessPhone ? normalizePhone(message.from) === businessPhone : normalizePhone(message.from) !== chatId;
              events.push({
                ...base, kind: 'message', origin: 'history', direction: fromBusiness ? 'outbound' : 'inbound', chatId,
                providerMessageId: String(message.id), messageType: content.type, content: content.content,
                mediaId: content.mediaId || null, mediaMime: content.mediaMime || null, createdAt: toDate(message.timestamp),
              });
            }
          }
        }
      } else if (field === 'smb_app_state_sync') {
        for (const item of value.state_sync || []) {
          if (item?.type !== 'contact' || item?.action === 'remove') continue;
          const chatId = normalizePhone(item?.contact?.phone_number);
          if (chatId) events.push({ ...base, kind: 'contact', chatId, name: item.contact?.full_name || item.contact?.first_name || null });
        }
      }
    }
  }
  return events;
}
