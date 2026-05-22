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

function preserveOriginalTemplateCasing(value) {
  return String(value || '');
}

function cleanPdfHtmlArtifacts(value) {
  let html = preserveOriginalTemplateCasing(value);

  html = html.replace(/\{\{\s*else\s*\}\}/gi, '');
  html = html.replace(/\{\{\s*#?if\s+[^}]+\}\}/gi, '');
  html = html.replace(/\{\{\s*\/if\s*\}\}/gi, '');
  html = html.replace(/\{\{\s*#?each\s+[^}]+\}\}/gi, '');
  html = html.replace(/\{\{\s*\/each\s*\}\}/gi, '');
  html = html.replace(/\{\{\/?[^}]+\}\}/g, '');

  html = html.replace(/<p[^>]*>\s*\}\s*<\/p>/gi, '');
  html = html.replace(/<div[^>]*>\s*\}\s*<\/div>/gi, '');
  html = html.replace(/<span[^>]*>\s*\}\s*<\/span>/gi, '');
  html = html.replace(/<li[^>]*>\s*\}\s*<\/li>/gi, '');
  html = html.replace(/(^|>)\s*\}\s*(?=<|$)/g, '$1');
  html = html.replace(/\n\s*\}\s*\n/g, '\n');
  html = html.replace(/(^|\n)\s*\}\s*($|\n)/g, '$1');

  return html.trim();
}

const PREMIUM_CSS = `
  @page {
    size: A4;
    margin: 22mm 25mm 21mm 25mm;
  }

  * {
    box-sizing: border-box;
  }

  html,
  body {
    padding: 0;
    margin: 0;
    width: 100%;
    background: #ffffff;
  }

  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    line-height: 1.32;
    color: #000000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body,
  body *:not(h1):not(h2):not(h3):not(.keep-uppercase):not([data-keep-uppercase]) {
    text-transform: none !important;
    letter-spacing: normal !important;
  }

  main,
  article,
  section,
  .contract-body,
  .contract-page {
    max-width: 100%;
  }

  h1 {
    font-size: 20pt;
    font-weight: 800;
    line-height: 1.14;
    letter-spacing: -0.01em;
    margin: 0 0 20px;
    color: #000000;
    text-transform: uppercase !important;
    break-after: avoid;
    page-break-after: avoid;
  }

  h2 {
    font-size: 17pt;
    font-weight: 800;
    line-height: 1.14;
    letter-spacing: -0.01em;
    margin: 18px 0 12px;
    color: #000000;
    text-transform: uppercase !important;
    border-top: 0 !important;
    padding-top: 0 !important;
    break-after: avoid;
    page-break-after: avoid;
  }

  h3 {
    font-size: 11.5pt;
    font-weight: 800;
    margin: 13px 0 8px;
    color: #000000;
    text-transform: uppercase !important;
    break-after: avoid;
    page-break-after: avoid;
  }

  h4,
  h5,
  h6 {
    font-size: 11pt;
    font-weight: 800;
    margin: 11px 0 6px;
    color: #000000;
    break-after: avoid;
    page-break-after: avoid;
  }

  p {
    margin: 0 0 8px;
    color: #000000;
  }

  strong,
  b {
    font-weight: 800;
  }

  hr {
    border: 0;
    border-top: 1px solid #bdbdbd;
    margin: 14px 0 12px;
  }

  ul,
  ol {
    margin: 6px 0 10px 20px;
    padding: 0;
  }

  li {
    margin: 0 0 4px;
  }

  a {
    color: #0000ee;
    text-decoration: underline;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 12px;
  }

  td,
  th {
    vertical-align: top;
    padding: 4px 6px;
    border: 1px solid #dddddd;
  }

  .signature-certificate {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-top: 18px;
    padding-top: 0;
    border: 0;
    border-radius: 0;
    background: #ffffff;
    color: #000000;
  }

  .signature-certificate h2 {
    border-top: 0 !important;
    padding-top: 0 !important;
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 11.5pt;
    line-height: 1.2;
    letter-spacing: 0;
  }

  .signature-certificate p {
    margin: 0 0 5px;
  }

  .signature-certificate .hash {
    word-break: break-all;
    overflow-wrap: anywhere;
    font-size: 9pt;
    line-height: 1.25;
  }

  .validation-block {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-top: 12px;
    margin-bottom: 10px;
    border: 0;
    padding: 0;
    background: #ffffff;
  }

  .validation-block p {
    font-weight: 800;
    margin-bottom: 6px;
  }

  .validation-block img {
    display: block;
    width: 170px;
    height: 170px;
    object-fit: contain;
  }

  .technical-record {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-top: 14px;
    border: 0;
    padding: 0;
    background: #ffffff;
  }

  [data-contract-source="internal-fallback"] {
    display: none !important;
  }
`;


export function preparePremiumContractHtml(rawHtml) {
  const html = cleanPdfHtmlArtifacts(rawHtml);
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
  const cleanedHtml = cleanPdfHtmlArtifacts(html);
  const preparedHtml = applyPremiumContractCss ? preparePremiumContractHtml(cleanedHtml) : cleanedHtml;

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
        top: '22mm',
        right: '25mm',
        bottom: '21mm',
        left: '25mm',
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
