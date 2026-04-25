import crypto from 'crypto';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeFallback(value, fallback = 'Não disponível') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

export function extractSignerIp(headers) {
  const xff = String(headers.get('x-forwarded-for') || '').trim();
  if (xff) return xff.split(',')[0].trim();

  const cf = String(headers.get('cf-connecting-ip') || '').trim();
  if (cf) return cf;

  const realIp = String(headers.get('x-real-ip') || '').trim();
  if (realIp) return realIp;

  return 'Não disponível';
}

export function formatSignedAtBR(value) {
  const date = new Date(value || Date.now());
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

export function formatSignedAtUtc(value) {
  const date = new Date(value || Date.now());
  return date.toISOString();
}

export function generateVerificationToken() {
  return crypto.randomUUID().replace(/-/g, '');
}

export function generateHtmlSha256(html) {
  return crypto.createHash('sha256').update(String(html || ''), 'utf8').digest('hex');
}

export function getPublicAppUrl() {
  const baseUrl = String(
    process.env.NEXT_PUBLIC_APP_URL
      || process.env.APP_PUBLIC_URL
      || 'https://app.bandaharmonics.com'
  ).trim();

  return baseUrl.replace(/\/+$/, '');
}

export function ensureNoRawPlaceholders(html) {
  const normalized = String(html || '').trim();
  if (!normalized) {
    throw new Error('HTML final do contrato está vazio.');
  }

  if (normalized.includes('{{')) {
    throw new Error('Ainda existem placeholders não resolvidos no HTML final do contrato.');
  }

  return normalized;
}

async function generateQrDataUrl(verifyUrl) {
  const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=png&data=${encodeURIComponent(verifyUrl)}`;
  const response = await fetch(qrApi, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Falha ao gerar QR Code (status ${response.status}).`);
  }

  const mime = response.headers.get('content-type') || 'image/png';
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

export async function buildSignedContractHtml({
  contractHtml,
  signerName,
  signerCpf,
  signedAt,
  signerIp,
  userAgent,
  origin,
  contractId,
  validationToken,
  verificationToken,
}) {
  const signedAtIso = formatSignedAtUtc(signedAt);
  const signedAtBr = formatSignedAtBR(signedAtIso);
  const safeIp = normalizeFallback(signerIp);
  const safeUa = normalizeFallback(userAgent);
  const safeName = normalizeFallback(signerName, 'Não informado');
  const safeCpf = normalizeFallback(signerCpf, 'Não informado');
  const safeOrigin = normalizeFallback(origin, 'Sistema Harmonics');
  const safeContractId = normalizeFallback(contractId, 'Não informado');
  const resolvedToken = normalizeFallback(validationToken || verificationToken);
  const verifyUrl = `${getPublicAppUrl()}/verify/${resolvedToken}`;

  const immutableHtml = ensureNoRawPlaceholders(contractHtml);
  const documentHash = generateHtmlSha256(immutableHtml);
  const qrCodeDataUrl = await generateQrDataUrl(verifyUrl);

  const signatureBlock = `
<section class="signature-certificate">
  <h2>CERTIFICAÇÃO DE ASSINATURA ELETRÔNICA</h2>
  <p><strong>Signatário:</strong> ${escapeHtml(safeName)}</p>
  <p><strong>CPF:</strong> ${escapeHtml(safeCpf)}</p>
  <p><strong>Data e hora da assinatura (BR):</strong> ${escapeHtml(signedAtBr)}</p>
  <p><strong>Data e hora UTC:</strong> ${escapeHtml(signedAtIso)}</p>
  <p><strong>IP:</strong> ${escapeHtml(safeIp)}</p>
  <p><strong>User Agent:</strong> ${escapeHtml(safeUa)}</p>
  <p><strong>Origem:</strong> ${escapeHtml(safeOrigin)}</p>
  <p><strong>ID do contrato:</strong> ${escapeHtml(safeContractId)}</p>
  <p class="hash"><strong>Hash SHA256:</strong> ${escapeHtml(documentHash)}</p>
  <p><strong>Link de validação:</strong> <a href="${escapeHtml(verifyUrl)}" target="_blank" rel="noreferrer">${escapeHtml(verifyUrl)}</a></p>
  <div class="validation-block">
    <p><strong>QR Code de validação</strong></p>
    <img src="${qrCodeDataUrl}" alt="QR Code de validação do contrato" width="180" height="180" />
  </div>
  <p>Este documento foi assinado eletronicamente através do sistema Harmonics, mediante confirmação de leitura e aceite do contratante. A manifestação de vontade foi registrada eletronicamente e vinculada ao conteúdo deste documento por meio de hash criptográfico SHA256.</p>
</section>`.trim();

  return {
    signedHtml: `${immutableHtml}\n${signatureBlock}`,
    immutableHtml,
    documentHash,
    verifyUrl,
    qrCodeDataUrl,
    signedAtIso,
    signedAtBr,
  };
}
