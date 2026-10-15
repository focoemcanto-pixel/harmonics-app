// Link do comprovante para o portal do cliente: passa pelo app (token do portal + URL assinada)
// em vez da URL pública do bucket, para continuar funcionando quando o bucket ficar privado.
export function buildPublicPaymentProofUrl(token, paymentId, baseUrl = '') {
  const safeToken = String(token || '').trim();
  const safePaymentId = String(paymentId || '').trim();
  if (!safeToken || !safePaymentId) return '';
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  return `${base}/api/public/files/payment-proof/${encodeURIComponent(safeToken)}/${encodeURIComponent(safePaymentId)}`;
}
