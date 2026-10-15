// Link estável para o PDF do contrato que passa pelo app (autorização por token + URL
// assinada), em vez da URL pública do bucket. Com isso o bucket pode ser fechado sem quebrar
// os links novos enviados ao cliente.
export function buildPublicContractFileUrl(token, baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || '') {
  const safeToken = String(token || '').trim();
  if (!safeToken) return '';
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  return `${base}/api/public/files/contract/${encodeURIComponent(safeToken)}`;
}

// Link do PDF de um contrato já carregado: usa o token do próprio contrato (resolve exatamente
// esse contrato) e, na falta dele, o token do pré-contrato. Sem token, mantém a URL gravada.
export function buildContractPdfHref(contract, { fallbackToken = '', baseUrl } = {}) {
  const pdfUrl = String(contract?.pdf_url || '').trim();
  if (!pdfUrl) return '';
  const token = String(contract?.public_token || '').trim() || String(fallbackToken || '').trim();
  if (!token) return pdfUrl;
  return baseUrl === undefined ? buildPublicContractFileUrl(token) : buildPublicContractFileUrl(token, baseUrl);
}
