const DEFAULT_HTML_TO_PDF_PATH = '/html-to-pdf';

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function resolveHtmlToPdfEndpoint() {
  const directEndpoint = String(process.env.CONTRACT_SERVICE_HTML_TO_PDF_URL || '').trim();
  if (directEndpoint) return directEndpoint;

  const serviceUrl = trimTrailingSlash(
    process.env.CONTRACT_SERVICE_URL || process.env.NEXT_PUBLIC_CONTRACT_SERVICE_URL || ''
  );

  if (!serviceUrl) {
    throw new Error('CONTRACT_SERVICE_URL não configurada para gerar PDF interno.');
  }

  const endpointPath = String(process.env.CONTRACT_SERVICE_HTML_TO_PDF_PATH || DEFAULT_HTML_TO_PDF_PATH)
    .trim() || DEFAULT_HTML_TO_PDF_PATH;

  const normalizedPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  return `${serviceUrl}${normalizedPath}`;
}

function getServiceApiKey() {
  return String(
    process.env.CONTRACT_SERVICE_API_KEY || process.env.NEXT_PUBLIC_CONTRACT_SERVICE_API_KEY || ''
  ).trim();
}

const PREMIUM_CSS = `
  @page {
    size: A4;
    margin: 22mm 24mm;
  }

  html,
  body {
    padding: 0;
    margin: 0;
    width: 100%;
  }

  body {
    font-family: Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.32;
    color: #111827;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  h1 {
    font-size: 20pt;
    font-weight: 800;
    line-height: 1.15;
    margin: 0 0 18px;
    break-after: avoid;
    page-break-after: avoid;
  }

  h2,
  h3 {
    font-size: 11.5pt;
    font-weight: 800;
    margin: 18px 0 8px;
    break-after: avoid;
    page-break-after: avoid;
  }

  p {
    margin: 0 0 8px;
  }

  .signature-certificate,
  .technical-record,
  .validation-block {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-top: 24px;
    border: 1px solid #dbe3ef;
    border-radius: 12px;
    padding: 16px;
    background: #f8fafc;
  }

  .hash {
    word-break: break-all;
    font-size: 9pt;
    color: #334155;
  }
`;


export function preparePremiumContractHtml(rawHtml) {
  const html = String(rawHtml || '').trim();
  if (!html) return '';

  const styleTag = `<style id="harmonics-premium-contract-pdf-css">${PREMIUM_CSS}</style>`;

  if (/<!doctype html/i.test(html) || /<html[\s>]/i.test(html)) {
    if (/<head[\s>]/i.test(html)) {
      return html.replace(/<\/head>/i, `${styleTag}</head>`);
    }

    return html.replace(/<html([^>]*)>/i, `<html$1><head><meta charset="utf-8" />${styleTag}</head>`);
  }

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />${styleTag}</head><body>${html}</body></html>`;
}

function extractPdfBase64(json) {
  return String(
    json?.pdfBase64 ||
      json?.pdf_base64 ||
      json?.data?.pdfBase64 ||
      json?.data?.pdf_base64 ||
      ''
  ).trim();
}

function extractPdfUrl(json) {
  return String(json?.pdfUrl || json?.pdf_url || json?.data?.pdfUrl || json?.data?.pdf_url || '').trim();
}

export async function generatePdfBufferFromHtml({
  html,
  contractId,
  precontractId,
  applyPremiumContractCss = true,
  fileName = null,
}) {
  const endpoint = resolveHtmlToPdfEndpoint();
  const apiKey = getServiceApiKey();
  const preparedHtml = applyPremiumContractCss ? preparePremiumContractHtml(html) : String(html || '').trim();

  if (!preparedHtml) {
    throw new Error('HTML final não informado para geração do PDF.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/pdf,application/json,text/plain,*/*',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
    body: JSON.stringify({
      html: preparedHtml,
      fileName: fileName || undefined,
      contractId: contractId || null,
      precontractId: precontractId || null,
      format: 'A4',
      margin: {
        top: '20mm',
        right: '18mm',
        bottom: '20mm',
        left: '18mm',
      },
      printBackground: true,
      preferCSSPageSize: true,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Falha ao gerar PDF no serviço externo (status ${response.status}).`);
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('application/pdf')) {
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const json = await response.json().catch(() => null);
  const base64 = extractPdfBase64(json);

  if (base64) {
    return Buffer.from(base64, 'base64');
  }

  const pdfUrl = extractPdfUrl(json);
  if (pdfUrl) {
    const fetchPdf = await fetch(pdfUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/pdf,*/*',
      },
    });

    if (!fetchPdf.ok) {
      const text = await fetchPdf.text();
      throw new Error(text || `Falha ao baixar PDF do serviço externo (status ${fetchPdf.status}).`);
    }

    const arrayBuffer = await fetchPdf.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  throw new Error('Serviço de PDF respondeu sem conteúdo de PDF válido.');
}
