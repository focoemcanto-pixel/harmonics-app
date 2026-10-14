// Link estável para o PDF do contrato que passa pelo app (autorização por token + URL
// assinada), em vez da URL pública do bucket. Com isso o bucket pode ser fechado sem quebrar
// os links novos enviados ao cliente.
export function buildPublicContractFileUrl(token, baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || '') {
  const safeToken = String(token || '').trim();
  if (!safeToken) return '';
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  return `${base}/api/public/files/contract/${encodeURIComponent(safeToken)}`;
}
