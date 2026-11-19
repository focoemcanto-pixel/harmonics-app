import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isIncomingProofMedia, stagePaymentEvidence, reportedPaymentSummary } from '../../lib/ai/inbox/payment-evidence.mjs';

const incoming = (overrides = {}) => ({
  kind: 'message', origin: 'customer', direction: 'inbound',
  messageType: 'image', mediaMime: 'image/jpeg',
  mediaId: 'synthetic-media-id', providerMessageId: 'wamid.synthetic-1',
  ...overrides,
});

function fakeDb() {
  const messages = [{ id: 'synthetic-message-1', workspace_id: 'workspace-a', provider_message_id: 'wamid.synthetic-1' }];
  const evidence = [];
  const calls = [];
  return {
    evidence, calls,
    from(table) {
      if (table === 'ai_messages') {
        const filter = {};
        const query = {
          select() { return query; },
          eq(field, value) { filter[field] = value; return query; },
          async maybeSingle() {
            return { data: messages.find((row) => Object.entries(filter).every(([field, value]) => row[field] === value)) || null, error: null };
          },
        };
        return query;
      }
      if (table === 'ai_payment_evidence') return {
        async upsert(record, opts) {
          calls.push({ table, record, opts });
          if (!evidence.some((r) => r.workspace_id === record.workspace_id && r.message_id === record.message_id)) evidence.push(record);
          return { error: null };
        },
      };
      throw new Error('Unexpected write to ' + table);
    },
  };
}

test('detecta apenas imagens e PDFs recebidos de clientes, nunca histórico ou ecos do app', () => {
  assert.equal(isIncomingProofMedia(incoming()), true);
  assert.equal(isIncomingProofMedia(incoming({ messageType: 'document', mediaMime: 'application/pdf' })), true);
  for (const event of [
    incoming({ origin: 'business_app' }),
    incoming({ origin: 'history' }),
    incoming({ direction: 'outbound' }),
    incoming({ messageType: 'video', mediaMime: 'video/mp4' }),
    incoming({ messageType: 'document', mediaMime: 'application/msword' }),
    incoming({ mediaId: null }),
  ]) assert.equal(isIncomingProofMedia(event), false);
});

test('ingestão idempotente: replay de webhook sem message_id busca a mensagem existente', async () => {
  const db = fakeDb();
  const first = await stagePaymentEvidence({
    supabase: db, workspaceId: 'workspace-a', event: incoming(),
    messageRow: { message_id: 'synthetic-message-1', conversation_id: 'synthetic-conversation-1' },
  });
  const replay = await stagePaymentEvidence({
    supabase: db, workspaceId: 'workspace-a', event: incoming(),
    messageRow: { message_id: null, conversation_id: 'synthetic-conversation-1' },
  });
  assert.equal(first.staged, true);
  assert.equal(replay.staged, true);
  assert.equal(db.evidence.length, 1);
  assert.equal(db.evidence[0].status, 'candidate');
  assert.equal(db.calls[0].opts.ignoreDuplicates, true);
  assert.deepEqual(db.calls.map((c) => c.table), ['ai_payment_evidence','ai_payment_evidence']);
});

test('ausência do registro fonte falha fechada sem inventar vínculo', async () => {
  await assert.rejects(() => stagePaymentEvidence({
    supabase: fakeDb(), workspaceId: 'workspace-b', event: incoming(),
    messageRow: { message_id: null, conversation_id: 'synthetic-conversation-2' },
  }), /evidence_source_message_missing/);
});

test('comprovante parcial altera somente saldo informado, jamais caixa confirmado', () => {
  const result = reportedPaymentSummary({
    contractCents: 210000,
    cashReceipts: [],
    proofs: [{ message_id: 'm1', status: 'matched', amount_cents: 50000 }],
  });
  assert.equal(result.informedCents, 50000);
  assert.equal(result.confirmedCents, 0);
  assert.equal(result.remainingReportedCents, 160000);
  assert.equal(result.remainingConfirmedCents, 210000);
});

test('comprovante repetido, rejeitado ou ambíguo não vira pagamento duplicado', () => {
  const result = reportedPaymentSummary({
    contractCents: 100000,
    proofs: [
      { message_id: 'm1', status: 'matched', amount_cents: 20000 },
      { message_id: 'm1', status: 'matched', amount_cents: 20000 },
      { message_id: 'm2', status: 'needs_review', amount_cents: 30000 },
      { message_id: 'm3', status: 'rejected', amount_cents: 15000 },
      { message_id: 'm4', status: 'extracted', amount_cents: 25000 },
    ],
  });
  assert.equal(result.informedCents, 20000);
  assert.equal(result.remainingReportedCents, 80000);
});

test('após conciliação não soma novamente o comprovante já coberto por recebimento', () => {
  const result = reportedPaymentSummary({
    contractCents: 100000,
    cashReceipts: [{ id: 'bank-1', amount_cents: 30000 }, { id: 'reversed-1', amount_cents: 9000, reversed: true }],
    proofs: [
      { message_id: 'm1', status: 'reconciled', amount_cents: 30000 },
      { message_id: 'm2', status: 'matched', amount_cents: 5000 },
    ],
  });
  assert.equal(result.confirmedCents, 30000);
  assert.equal(result.informedCents, 5000);
  assert.equal(result.remainingReportedCents, 65000);
  assert.equal(result.remainingConfirmedCents, 70000);
});

test('valor divergente é sinalizado, e não vira saldo negativo', () => {
  const result = reportedPaymentSummary({
    contractCents: 40000,
    proofs: [{ message_id: 'm1', status: 'matched', amount_cents: 45000 }],
  });
  assert.equal(result.overpaidReportedCents, 5000);
  assert.equal(result.remainingReportedCents, 0);
});
