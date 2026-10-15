import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeSupabase } from './helpers/fake-supabase.mjs';

const links = await import('../lib/files/public-file-links.js');
const scopeLib = await import('../lib/files/portal-token-scope.js');

const STORAGE_URL = 'https://xsm.supabase.co/storage/v1/object/public/contract-pdfs/workspaces/ws-1/contracts/c1.pdf';
const DRIVE_URL = 'https://drive.google.com/file/d/abc/view';
const CONTRACT_ID = '11111111-1111-4111-8111-111111111111';
const PAYMENT_ID = '22222222-2222-4222-8222-222222222222';

test('PDF no nosso storage vira link do app (token + contrato fixado); Drive continua igual', () => {
  assert.equal(
    links.buildPublicContractFileHref({ token: 'tok-abc-123', pdfUrl: STORAGE_URL, contractId: CONTRACT_ID }),
    `/api/public/files/contract/tok-abc-123?c=${CONTRACT_ID}`
  );
  assert.equal(
    links.buildPublicContractFileHref({ token: 'tok-abc-123', pdfUrl: STORAGE_URL, baseUrl: 'https://app.x.com/' }),
    'https://app.x.com/api/public/files/contract/tok-abc-123'
  );
  assert.equal(links.buildPublicContractFileHref({ token: 'tok-abc-123', pdfUrl: DRIVE_URL, contractId: CONTRACT_ID }), DRIVE_URL);
  assert.equal(links.buildPublicContractFileHref({ token: 'tok-abc-123', pdfUrl: '' }), '');
  // sem token não há como montar o link do app: mantém o valor anterior (não quebra)
  assert.equal(links.buildPublicContractFileHref({ token: '', pdfUrl: STORAGE_URL }), STORAGE_URL);
  // id inválido não é anexado
  assert.equal(links.buildPublicContractFileHref({ token: 'tok-abc-123', pdfUrl: STORAGE_URL, contractId: 'x' }), '/api/public/files/contract/tok-abc-123');
});

test('comprovante: caminho do bucket ou URL do storage vira link do app; URL externa continua igual', () => {
  const expected = `/api/public/files/payment-proof/tok-abc-123?p=${PAYMENT_ID}`;
  assert.equal(links.buildPublicPaymentProofHref({ token: 'tok-abc-123', paymentId: PAYMENT_ID, proofUrl: 'workspaces/ws/events/e/payments/f.jpg' }), expected);
  assert.equal(links.buildPublicPaymentProofHref({ token: 'tok-abc-123', paymentId: PAYMENT_ID, proofUrl: 'https://xsm.supabase.co/storage/v1/object/public/payment-proofs/a.jpg' }), expected);
  assert.equal(links.buildPublicPaymentProofHref({ token: 'tok-abc-123', paymentId: PAYMENT_ID, proofUrl: 'https://outro.site/a.jpg' }), 'https://outro.site/a.jpg');
  assert.equal(links.buildPublicPaymentProofHref({ token: 'tok-abc-123', paymentId: null, proofUrl: 'a/b.jpg' }), '');
  assert.equal(links.buildPublicPaymentProofHref({ token: 'tok-abc-123', paymentId: PAYMENT_ID, proofUrl: '' }), '');
});

function scopeSupabase() {
  return createFakeSupabase({
    tables: {
      precontracts: [{ id: 'pre-1', event_id: 'ev-1', public_token: 'tok-pre' }],
      contracts: [{ id: 'con-2', event_id: 'ev-2', precontract_id: 'pre-2', public_token: 'tok-con' }],
      repertoire_config: [{ event_id: 'ev-3', client_public_token: 'tok-rep' }],
    },
  });
}

test('escopo do token do portal cobre os 3 tipos de token aceitos pelo portal', async () => {
  const supabase = scopeSupabase();
  const pre = await scopeLib.resolvePortalTokenScope(supabase, 'tok-pre');
  assert.ok(scopeLib.isContractInPortalScope(pre, { id: 'x', precontract_id: 'pre-1' }));
  assert.ok(scopeLib.isContractInPortalScope(pre, { id: 'x', event_id: 'ev-1' }));
  assert.ok(scopeLib.isPaymentInPortalScope(pre, { event_id: 'ev-1' }));

  const con = await scopeLib.resolvePortalTokenScope(supabase, 'tok-con');
  assert.ok(scopeLib.isContractInPortalScope(con, { id: 'con-2' }));
  assert.ok(scopeLib.isPaymentInPortalScope(con, { event_id: 'ev-2' }));

  const rep = await scopeLib.resolvePortalTokenScope(supabase, 'tok-rep');
  assert.ok(scopeLib.isPaymentInPortalScope(rep, { event_id: 'ev-3' }));
});

test('token não dá acesso a contrato/pagamento de outro evento ou workspace', async () => {
  const supabase = scopeSupabase();
  const pre = await scopeLib.resolvePortalTokenScope(supabase, 'tok-pre');
  assert.equal(scopeLib.isContractInPortalScope(pre, { id: 'con-2', precontract_id: 'pre-2', event_id: 'ev-2' }), false);
  assert.equal(scopeLib.isPaymentInPortalScope(pre, { event_id: 'ev-2' }), false);
  assert.equal(scopeLib.isPaymentInPortalScope(pre, { event_id: null }), false);

  const unknown = await scopeLib.resolvePortalTokenScope(supabase, 'tok-inexistente');
  assert.equal(scopeLib.isContractInPortalScope(unknown, { id: 'con-2', event_id: 'ev-2' }), false);
  assert.equal(scopeLib.isPaymentInPortalScope(unknown, { event_id: 'ev-1' }), false);
});
