// Link do comprovante para o portal do cliente: passa pelo app (token do portal + URL assinada)
// em vez da URL pública do bucket, para continuar funcionando quando o bucket ficar privado.
export function buildPublicPaymentProofUrl(token, paymentId, baseUrl = '') {
  const safeToken = String(token || '').trim();
  const safePaymentId = String(paymentId || '').trim();
  if (!safeToken || !safePaymentId) return '';
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  return `${base}/api/public/files/payment-proof/${encodeURIComponent(safeToken)}/${encodeURIComponent(safePaymentId)}`;
}

// URL externa informada manualmente pelo admin (banco, Drive...) não está no nosso bucket:
// mantém o link direto. Caminho relativo ou URL do storage do projeto passa pelo endpoint.
export function buildPaymentProofHref(token, payment, baseUrl = '') {
  const stored = String(payment?.proof_file_url || '').trim();
  if (!stored) return '';
  if (/^https?:\/\//i.test(stored) && !/\/storage\/v1\/object\//i.test(stored)) return stored;
  return buildPublicPaymentProofUrl(token, payment?.id, baseUrl) || stored;
}
