// Links de arquivos (PDF de contrato / comprovante) entregues a quem tem o token do portal.
//
// Em vez de expor a URL pública do Supabase Storage (que deixa de funcionar quando os buckets
// ficarem privados — BE-2), o link aponta para um endpoint do app que valida o token e redireciona
// para uma URL assinada de curta duração. URLs externas (ex.: Google Drive) continuam como estão.
// Sem dependência de env: pode ser usado no servidor e no browser.

const STORAGE_OBJECT_MARKER = /\/storage\/v1\/object\/(?:public|sign|authenticated)\//i;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

export function isUuid(value) {
  return UUID_REGEX.test(String(value || '').trim());
}

export function isSupabaseStorageUrl(value) {
  return STORAGE_OBJECT_MARKER.test(String(value || ''));
}

// Arquivo guardado no nosso storage: URL do Supabase Storage ou caminho "bucket/objeto" sem host.
export function isStoredFileReference(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  return isSupabaseStorageUrl(raw) || !isHttpUrl(raw);
}

function withBase(path, baseUrl) {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  return base ? `${base}${path}` : path;
}

/**
 * Link do PDF do contrato para o portal do cliente / página de contrato / verificação.
 * - arquivo no nosso storage => /api/public/files/contract/<token>[?c=<contractId>]
 * - URL externa (Drive etc.) => a própria URL (comportamento anterior)
 */
export function buildPublicContractFileHref({ token, pdfUrl, contractId = null, baseUrl = '' }) {
  const raw = String(pdfUrl || '').trim();
  const safeToken = String(token || '').trim();
  if (!raw) return '';
  if (!safeToken || !isStoredFileReference(raw)) return raw;
  const query = isUuid(contractId) ? `?c=${String(contractId).trim()}` : '';
  return withBase(`/api/public/files/contract/${encodeURIComponent(safeToken)}${query}`, baseUrl);
}

/**
 * Link do comprovante de pagamento para o portal do cliente.
 * - comprovante no nosso storage => /api/public/files/payment-proof/<token>?p=<paymentId>
 * - URL externa => a própria URL
 */
export function buildPublicPaymentProofHref({ token, paymentId, proofUrl, baseUrl = '' }) {
  const raw = String(proofUrl || '').trim();
  const safeToken = String(token || '').trim();
  if (!raw) return '';
  if (!isStoredFileReference(raw)) return raw;
  if (!safeToken || !isUuid(paymentId)) return '';
  return withBase(
    `/api/public/files/payment-proof/${encodeURIComponent(safeToken)}?p=${String(paymentId).trim()}`,
    baseUrl
  );
}
