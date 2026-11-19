import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planWhatsAppProofSubmission as plan } from '../../lib/ai/inbox/payment-submission-plan.mjs';

const base = {
  eventId: 'synthetic-event-01',
  amountCents: 50000,
  paymentDate: '2030-05-12',
  paymentMethod: 'pix',
  providerMessageId: 'wamid.synthetic-777',
};
const payment = (overrides = {}) => ({
  id: 'synthetic-payment-01', event_id: base.eventId,
  amount: 500, payment_date: base.paymentDate, payment_method: 'pix',
  status: 'em_analise', proof_file_url: null,
  ...overrides,
});

test('cliente não anexou no painel: Nara pode criar apenas pagamento informado', () => {
  assert.equal(plan({ ...base, existingPayments: [] }).action, 'create_pending');
});

test('pagamento existente no painel sem arquivo: anexar em vez de duplicar', () => {
  assert.deepEqual(plan({ ...base, existingPayments: [payment()] }), {
    action: 'attach_existing', paymentId: 'synthetic-payment-01',
    reason: 'same_event_date_amount_method_no_file',
  });
});

test('comprovante já anexado: não cadastrar outro pagamento sem prova exata', () => {
  assert.equal(plan({ ...base, existingPayments: [payment({ proof_file_url: 'workspaces/synthetic/events/synthetic/payments/a.pdf' })] }).action, 'needs_review');
});

test('a mesma mensagem ou arquivo nunca cria pagamento duplicado', () => {
  assert.equal(plan({ ...base, existingPayments: [payment({ nara_provider_message_id: base.providerMessageId })] }).action, 'already_registered');
  assert.equal(plan({ ...base, proofSha256: 'b'.repeat(64), existingPayments: [payment({
    proof_file_url: 'private.pdf', proof_sha256: 'b'.repeat(64),
  })] }).action, 'already_registered');
});

test('dois pagamentos iguais na mesma data ou eventos sem escopo vão para revisão', () => {
  assert.equal(plan({ ...base, existingPayments: [payment(), payment({ id: 'synthetic-payment-02' })] }).reason, 'multiple_same_day_payments');
  assert.equal(plan({ ...base, existingPayments: [payment({ event_id: 'other-event' })] }).reason, 'unscoped_payment_rows');
});

test('datas/valores divergentes e pagamentos rejeitados não são vinculados silenciosamente', () => {
  assert.equal(plan({ ...base, existingPayments: [payment({ status: 'rejeitado' })] }).reason, 'existing_payment_rejected');
  assert.equal(plan({ ...base, existingPayments: [payment({ payment_method: 'cartao' })] }).reason, 'method_mismatch');
  assert.equal(plan({ ...base, paymentDate: null, existingPayments: [] }).action, 'needs_review');
  assert.equal(plan({ ...base, amountCents: 0, existingPayments: [] }).action, 'needs_review');
});

test('parcela adicional em data distinta: separada, com saldo calculado posteriormente', () => {
  assert.equal(plan({ ...base, paymentDate: '2030-05-13', existingPayments: [payment()] }).action, 'create_pending');
});
