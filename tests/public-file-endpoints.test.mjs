import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'service-role-test-key';

const { GET: contractFile } = await import('../app/api/public/files/contract/[token]/route.js');
const { GET: proofFile } = await import('../app/api/public/files/payment-proof/[token]/[paymentId]/route.js');

const STORAGE = 'https://proj.supabase.co/storage/v1/object/public';
const tables = {
  precontracts: [
    { id: 'pre-a', public_token: 'tok-precontract-a', event_id: 'ev-a' },
    { id: 'pre-b', public_token: 'tok-precontract-b', event_id: 'ev-b' },
  ],
  contracts: [
    { id: 'c-a', public_token: 'tok-contract-a', precontract_id: 'pre-a', event_id: 'ev-a', workspace_id: 'ws-a', created_at: '2026-01-01', pdf_url: `${STORAGE}/contract-pdfs/contracts/pre-a/contrato-assinado.pdf` },
    { id: 'c-b', public_token: 'tok-contract-b', precontract_id: 'pre-b', event_id: 'ev-b', workspace_id: 'ws-b', created_at: '2026-01-01', pdf_url: `${STORAGE}/contract-pdfs/contracts/pre-b/contrato-assinado.pdf` },
    { id: 'c-drive', public_token: 'tok-contract-drive', event_id: 'ev-d', workspace_id: 'ws-a', created_at: '2026-01-01', pdf_url: 'https://drive.google.com/file/d/abc/view' },
    { id: 'c-evil-bucket', public_token: 'tok-contract-evil1', event_id: 'ev-x', workspace_id: 'ws-a', created_at: '2026-01-01', pdf_url: `${STORAGE}/payment-proofs/workspaces/ws-b/events/ev-b/payments/x.pdf` },
    { id: 'c-evil-host', public_token: 'tok-contract-evil2', event_id: 'ev-y', workspace_id: 'ws-a', created_at: '2026-01-01', pdf_url: 'https://attacker.example/phish.pdf' },
  ],
  repertoire_config: [],
  payments: [
    { id: '11111111-1111-4111-8111-111111111111', event_id: 'ev-a', workspace_id: 'ws-a', proof_file_url: 'workspaces/ws-a/events/ev-a/payments/a.pdf' },
    { id: '22222222-2222-4222-8222-222222222222', event_id: 'ev-b', workspace_id: 'ws-b', proof_file_url: 'workspaces/ws-b/events/ev-b/payments/b.pdf' },
    { id: '33333333-3333-4333-8333-333333333333', event_id: 'ev-a', workspace_id: 'ws-a', proof_file_url: 'workspaces/ws-b/events/ev-b/payments/b.pdf' },
  ],
};

function fakeSupabase() {
  const signed = [];
  return {
    signed,
    from(table) {
      const filters = [];
      const query = {
        select() { return query; },
        eq(column, value) { filters.push((row) => String(row[column]) === String(value)); return query; },
        not(column, op, value) { filters.push((row) => row[column] !== null && row[column] !== undefined); return query; },
        order() { return query; },
        limit() { return query; },
        async maybeSingle() {
          const rows = (tables[table] || []).filter((row) => filters.every((f) => f(row)));
          return { data: rows[0] || null, error: null };
        },
      };
      return query;
    },
    storage: {
      from(bucket) {
        return {
          async createSignedUrl(path) {
            signed.push(`${bucket}/${path}`);
            return { data: { signedUrl: `https://proj.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=t` }, error: null };
          },
        };
      },
    },
  };
}

const call = (handler, params, supabase) => handler(new Request('https://app.test/x'), { params: Promise.resolve(params) }, { supabase });

test('PDF por token: entrega URL assinada só do contrato do próprio token', async () => {
  const db = fakeSupabase();
  for (const token of ['tok-precontract-a', 'tok-contract-a']) {
    const res = await call(contractFile, { token }, db);
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location'), /\/object\/sign\/contract-pdfs\/contracts\/pre-a\//);
  }
  assert.ok(db.signed.every((p) => p.includes('/pre-a/')), 'nunca assina arquivo de outro contrato');
});

test('PDF por token: token inexistente, Drive, bucket alheio e host externo', async () => {
  const db = fakeSupabase();
  assert.equal((await call(contractFile, { token: 'tok-nao-existe-123' }, db)).status, 404);
  const drive = await call(contractFile, { token: 'tok-contract-drive' }, db);
  assert.equal(drive.status, 302);
  assert.equal(drive.headers.get('location'), 'https://drive.google.com/file/d/abc/view');
  assert.equal((await call(contractFile, { token: 'tok-contract-evil1' }, db)).status, 404, 'não assina objeto de outro bucket');
  assert.equal((await call(contractFile, { token: 'tok-contract-evil2' }, db)).status, 404, 'não redireciona para host externo');
  assert.equal(db.signed.length, 0);
});

test('comprovante por token: só pagamentos do evento do token e do mesmo workspace', async () => {
  const db = fakeSupabase();
  const own = await call(proofFile, { token: 'tok-precontract-a', paymentId: '11111111-1111-4111-8111-111111111111' }, db);
  assert.equal(own.status, 302);
  assert.match(own.headers.get('location'), /payment-proofs\/workspaces\/ws-a\//);
  assert.equal((await call(proofFile, { token: 'tok-precontract-a', paymentId: '22222222-2222-4222-8222-222222222222' }, db)).status, 404, 'pagamento de outro evento');
  assert.equal((await call(proofFile, { token: 'tok-precontract-a', paymentId: '33333333-3333-4333-8333-333333333333' }, db)).status, 404, 'arquivo de outro workspace');
  assert.equal((await call(proofFile, { token: 'tok-nao-existe-123', paymentId: '11111111-1111-4111-8111-111111111111' }, db)).status, 404);
  assert.deepEqual(db.signed, ['payment-proofs/workspaces/ws-a/events/ev-a/payments/a.pdf']);
});
