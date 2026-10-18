import { LEGAL_DOCUMENTS, validateLegalAcceptance } from '@/lib/legal/documents';

export const LEGAL_ACCEPTANCE_REQUIRED_MESSAGE =
  'Para criar sua conta, aceite os Termos de Uso e a Política de Privacidade vigentes.';

function requestMeta(request) {
  const headers = request?.headers;
  const ip = String(headers?.get?.('cf-connecting-ip') || headers?.get?.('x-forwarded-for') || '').split(',')[0].trim() || null;
  const userAgent = String(headers?.get?.('user-agent') || '').slice(0, 500) || null;
  return { ip, userAgent };
}

/**
 * Registra (de forma auditável) o aceite dos Termos e da Política: uma linha por documento, com
 * versão aceita, data/hora do aceite no navegador, data/hora do registro no servidor, IP e user agent.
 * Idempotente por (user_id, document, version). Retorna { ok:false, status:400 } se o aceite for
 * ausente ou de versão diferente da vigente.
 */
export async function recordLegalAcceptance({ supabase, request, user, acceptance, workspaceId = null, source }) {
  const valid = validateLegalAcceptance(acceptance);
  if (!valid.ok) {
    return { ok: false, status: 400, code: 'LEGAL_ACCEPTANCE_REQUIRED', reason: valid.reason, error: LEGAL_ACCEPTANCE_REQUIRED_MESSAGE };
  }

  const { ip, userAgent } = requestMeta(request);
  const base = {
    user_id: user.id,
    email: user.email || null,
    accepted_at: valid.acceptedAt,
    workspace_id: workspaceId,
    source: source || null,
    ip_address: ip,
    user_agent: userAgent,
  };
  const rows = [
    { ...base, document: LEGAL_DOCUMENTS.terms.key, version: valid.termsVersion },
    { ...base, document: LEGAL_DOCUMENTS.privacy.key, version: valid.privacyVersion },
  ];

  const { error } = await supabase
    .from('legal_acceptances')
    .upsert(rows, { onConflict: 'user_id,document,version', ignoreDuplicates: true });

  if (error) {
    console.error('[LEGAL_ACCEPTANCE][RECORD_FAILED]', { userId: user.id, code: error.code, message: error.message });
    return { ok: false, status: 500, code: 'LEGAL_ACCEPTANCE_RECORD_FAILED', error: 'Não foi possível registrar o aceite. Tente novamente.' };
  }
  return { ok: true, acceptance: valid };
}
