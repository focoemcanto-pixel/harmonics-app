/**
 * Cliente mínimo da WhatsApp Cloud API. `fetchImpl` injetável para testes.
 * Nunca registra token nem conteúdo de mensagem em log.
 */
export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH = 'https://graph.facebook.com';
const TIMEOUT_MS = 15_000;

async function graphFetch(fetchImpl, url, { token, method = 'GET', body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Envia texto livre (válido apenas dentro da janela de 24h de atendimento).
 * Resultado: sent (com id), failed (rejeição definitiva) ou unknown (timeout/rede: NÃO reenviar
 * sem reconciliação — a mensagem pode ter sido entregue).
 */
export async function sendTextMessage({ phoneNumberId, token, to, text, fetchImpl = fetch }) {
  let response;
  try {
    response = await graphFetch(fetchImpl, `${GRAPH}/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, {
      token,
      method: 'POST',
      body: { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body: text } },
    });
  } catch (error) {
    return { status: 'unknown', error: error?.name === 'AbortError' ? 'timeout' : 'network_error' };
  }
  const payload = await response.json().catch(() => ({}));
  if (response.ok && payload?.messages?.[0]?.id) {
    return { status: 'sent', providerMessageId: String(payload.messages[0].id) };
  }
  if (response.status >= 500) return { status: 'unknown', error: `http_${response.status}` };
  const code = payload?.error?.code ? String(payload.error.code) : `http_${response.status}`;
  return { status: 'failed', error: code };
}

/** Baixa mídia (áudio) recebida: 1) resolve URL, 2) baixa bytes com o mesmo token. */
export async function downloadMedia({ mediaId, token, fetchImpl = fetch, maxBytes = 16 * 1024 * 1024 }) {
  const meta = await graphFetch(fetchImpl, `${GRAPH}/${GRAPH_VERSION}/${encodeURIComponent(mediaId)}`, { token });
  if (!meta.ok) throw new Error(`media_meta_${meta.status}`);
  const info = await meta.json();
  if (!info?.url) throw new Error('media_url_missing');
  if (Number(info.file_size) > maxBytes) throw new Error('media_too_large');
  const file = await graphFetch(fetchImpl, info.url, { token });
  if (!file.ok) throw new Error(`media_download_${file.status}`);
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new Error('media_too_large');
  return { bytes, mime: info.mime_type || 'application/octet-stream' };
}

/**
 * Diagnóstico de elegibilidade/estado do número (somente leitura).
 * `is_on_biz_app` / `platform_type` indicam número em Coexistence com o app Business.
 */
export async function fetchPhoneNumberStatus({ phoneNumberId, token, fetchImpl = fetch }) {
  const fields = 'display_phone_number,verified_name,quality_rating,code_verification_status,platform_type,is_on_biz_app,throughput,name_status';
  const response = await graphFetch(fetchImpl, `${GRAPH}/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}?fields=${fields}`, { token });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, error: payload?.error?.code ? String(payload.error.code) : `http_${response.status}` };
  return {
    ok: true,
    displayPhone: payload.display_phone_number || null,
    verifiedName: payload.verified_name || null,
    qualityRating: payload.quality_rating || null,
    platformType: payload.platform_type || null,
    isOnBizApp: payload.is_on_biz_app ?? null,
    nameStatus: payload.name_status || null,
    throughput: payload.throughput?.level || null,
    coexistence: payload.is_on_biz_app === true,
  };
}

/** Janela de atendimento de 24h desde a última mensagem do cliente. */
export function isWithinCustomerServiceWindow(lastInboundAt, now = Date.now()) {
  if (!lastInboundAt) return false;
  const ts = new Date(lastInboundAt).getTime();
  return Number.isFinite(ts) && now - ts < 24 * 60 * 60 * 1000;
}

/**
 * Envia template aprovado na Meta (necessário fora da janela de 24h, ex.: follow-up).
 * `params` = variáveis do corpo, em ordem. Mesma semântica de resultado de sendTextMessage.
 */
export async function sendTemplateMessage({ phoneNumberId, token, to, name, language = 'pt_BR', params = [], fetchImpl = fetch }) {
  const components = params.length
    ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: String(text).slice(0, 1000) })) }]
    : [];
  let response;
  try {
    response = await graphFetch(fetchImpl, `${GRAPH}/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, {
      token,
      method: 'POST',
      body: { messaging_product: 'whatsapp', to, type: 'template', template: { name, language: { code: language }, ...(components.length ? { components } : {}) } },
    });
  } catch (error) {
    return { status: 'unknown', error: error?.name === 'AbortError' ? 'timeout' : 'network_error' };
  }
  const payload = await response.json().catch(() => ({}));
  if (response.ok && payload?.messages?.[0]?.id) return { status: 'sent', providerMessageId: String(payload.messages[0].id) };
  if (response.status >= 500) return { status: 'unknown', error: `http_${response.status}` };
  return { status: 'failed', error: payload?.error?.code ? String(payload.error.code) : `http_${response.status}` };
}
