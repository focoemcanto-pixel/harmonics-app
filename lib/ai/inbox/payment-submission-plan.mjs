/**
 * Decide se o comprovante enviado pelo WhatsApp já corresponde a um pagamento
 * registrado no painel do cliente. FUNÇÃO PURA: não lê dados pessoais, não grava
 * pagamentos e não afirma que houve crédito no banco.
 *
 * Chamador deve validar vínculo conversa -> cliente -> evento antes desta etapa,
 * consultar pagamentos somente do mesmo workspace/evento e adquirir lock/índice
 * transacional de idempotência antes de qualquer POST/UPDATE.
 */
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (value) => DATE.test(value) &&
  Number.isFinite(Date.parse(value + 'T12:00:00Z')) &&
  new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
const SAFE_STATUSES = new Set(['em_analise', 'pendente', 'pending', 'aguardando_validacao', 'confirmado', 'confirmed', 'pago', 'paid']);
const FAILED_STATUSES = new Set(['cancelado','cancelled','rejeitado','rejected']);
const normalize = (v) => String(v ?? '').trim().toLowerCase();
const sameAmount = (row, cents) => {
  const value = Number(row?.amount);
  return Number.isFinite(value) && Math.round(value * 100) === cents;
};
const sameMethod = (row, method) => normalize(row?.payment_method) === normalize(method);
const byEvent = (row, eventId) => String(row?.event_id || '') === eventId;
const uniqueAction = (action, payment, reason) => ({ action, paymentId: payment?.id || null, reason });

/**
 * Returns:
 * - already_registered: exact source/digest was registered; do not create another.
 * - attach_existing: ONE same-date/amount/method pending entry lacks a file;
 *   attach the proof to that existing payment, not create a new payment.
 * - create_pending: no possible existing matching entry; use the SAME approved
 *   `payments` + private payment-proof storage as the client's portal.
 * - needs_review: uncertain identification; no automatic writes.
 */
export function planWhatsAppProofSubmission({
  eventId, amountCents, paymentDate, paymentMethod, providerMessageId,
  proofSha256, existingPayments = [],
} = {}) {
  const id = String(eventId || '').trim();
  const date = String(paymentDate || '').trim();
  if (!id || !Number.isSafeInteger(amountCents) || amountCents <= 0 ||
      !validDate(date) ||
      !normalize(paymentMethod) || !Array.isArray(existingPayments)) {
    return uniqueAction('needs_review', null, 'missing_or_invalid_evidence');
  }
  // The caller must fetch with an event/workspace filter; reject mismatched
  // rows defensively so another tenant or event cannot be used for matching.
  if (existingPayments.some((payment) => !byEvent(payment, id))) {
    return uniqueAction('needs_review', null, 'unscoped_payment_rows');
  }
  const sameSource = existingPayments.filter((p) => providerMessageId && p.nara_provider_message_id === providerMessageId);
  if (sameSource.length > 1) return uniqueAction('needs_review', null, 'duplicate_source_records');
  if (sameSource.length === 1) return uniqueAction('already_registered', sameSource[0], 'same_whatsapp_message');

  const hash = normalize(proofSha256);
  if (hash && /^[0-9a-f]{64}$/.test(hash)) {
    const identicalFile = existingPayments.filter((p) => normalize(p.proof_sha256) === hash);
    if (identicalFile.length > 1) return uniqueAction('needs_review', null, 'duplicate_file_records');
    if (identicalFile.length === 1) return uniqueAction('already_registered', identicalFile[0], 'same_proof_file');
  }

  const likely = existingPayments.filter((p) => sameAmount(p, amountCents) && p.payment_date === date);
  if (likely.length > 1) return uniqueAction('needs_review', null, 'multiple_same_day_payments');
  if (likely.length === 1) {
    const p = likely[0];
    if (FAILED_STATUSES.has(normalize(p.status))) return uniqueAction('needs_review', p, 'existing_payment_rejected');
    if (!sameMethod(p, paymentMethod)) return uniqueAction('needs_review', p, 'method_mismatch');
    if (p.proof_file_url) return uniqueAction('needs_review', p, 'already_has_unverified_attachment');
    if (!SAFE_STATUSES.has(normalize(p.status))) return uniqueAction('needs_review', p, 'unknown_existing_status');
    return uniqueAction('attach_existing', p, 'same_event_date_amount_method_no_file');
  }
  return uniqueAction('create_pending', null, 'no_matching_payment');
}
