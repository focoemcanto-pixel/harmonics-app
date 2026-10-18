// Versões vigentes dos documentos legais. Ao alterar um texto em docs/legal/*.md, atualize a versão
// (e a linha "Versão" do próprio documento): novos aceites passam a registrar a versão nova.
export const LEGAL_DOCUMENTS = {
  terms: { key: 'terms', version: '2026-10-18', title: 'Termos de Uso', path: '/termos' },
  privacy: { key: 'privacy', version: '2026-10-18', title: 'Política de Privacidade', path: '/privacidade' },
};

export const CURRENT_LEGAL_VERSIONS = {
  termsVersion: LEGAL_DOCUMENTS.terms.version,
  privacyVersion: LEGAL_DOCUMENTS.privacy.version,
};

// Aceite enviado pelo cadastro: só vale se for das versões vigentes e com data válida.
export function validateLegalAcceptance(input, now = new Date()) {
  const termsVersion = String(input?.termsVersion || '').trim();
  const privacyVersion = String(input?.privacyVersion || '').trim();
  if (!termsVersion || !privacyVersion) return { ok: false, reason: 'missing' };
  if (termsVersion !== LEGAL_DOCUMENTS.terms.version || privacyVersion !== LEGAL_DOCUMENTS.privacy.version) {
    return { ok: false, reason: 'outdated_version' };
  }
  const acceptedAt = new Date(input?.acceptedAt || '');
  if (Number.isNaN(acceptedAt.getTime())) return { ok: false, reason: 'invalid_date' };
  // Data informada pelo navegador: aceita até 24 h no passado e 5 min no futuro (relógio do cliente).
  const diff = now.getTime() - acceptedAt.getTime();
  if (diff > 24 * 60 * 60 * 1000 || diff < -5 * 60 * 1000) return { ok: false, reason: 'invalid_date' };
  return { ok: true, termsVersion, privacyVersion, acceptedAt: acceptedAt.toISOString() };
}

export function buildLegalAcceptance(now = new Date()) {
  return { ...CURRENT_LEGAL_VERSIONS, acceptedAt: now.toISOString() };
}
