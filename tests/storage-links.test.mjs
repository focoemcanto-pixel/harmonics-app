import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'service-role-test-key';

const { buildContractPdfHref, buildPublicContractFileUrl } = await import('../lib/contracts/public-file-url.js');
const { buildPublicPaymentProofUrl, buildPaymentProofHref } = await import('../lib/payments/public-proof-url.js');
const { GET: getProof } = await import('../app/api/public/files/payment-proof/[token]/[paymentId]/route.js');
const { GET: getContract } = await import('../app/api/public/files/contract/[token]/route.js');

const PUBLIC_URL = 'https://x.supabase.co/storage/v1/object/public/contract-pdfs/contracts/abc/contrato-assinado.pdf';

test('PDF do contrato usa o token do próprio contrato, depois o do pré-contrato, e só então a URL gravada', () => {
  assert.equal(buildContractPdfHref({ pdf_url: PUBLIC_URL, public_token: 'ctr-token-123' }, { fallbackToken: 'pre-token-456', baseUrl: '' }), '/api/public/files/contract/ctr-token-123');
  assert.equal(buildContractPdfHref({ pdf_url: PUBLIC_URL, public_token: null }, { fallbackToken: 'pre-token-456', baseUrl: 'https://app.test/' }), 'https://app.test/api/public/files/contract/pre-token-456');
  assert.equal(buildContractPdfHref({ pdf_url: PUBLIC_URL }, { baseUrl: '' }), PUBLIC_URL);
  assert.equal(buildContractPdfHref({ pdf_url: '' , public_token: 'x'}, { baseUrl: '' }), '');
  assert.equal(buildPublicContractFileUrl('a b', ''), '/api/public/files/contract/a%20b');
});

test('link do comprovante do portal passa pelo endpoint com token e id do pagamento', () => {
  assert.equal(buildPublicPaymentProofUrl('tok-12345678', '6f1c2a54-1b2c-4d5e-8f90-123456789abc'), '/api/public/files/payment-proof/tok-12345678/6f1c2a54-1b2c-4d5e-8f90-123456789abc');
  assert.equal(buildPublicPaymentProofUrl('', 'x'), '');
  assert.equal(buildPublicPaymentProofUrl('tok', ''), '');
});

test('endpoints públicos de arquivo rejeitam token/id inválidos sem consultar o banco', async () => {
  const bad = await getProof(new Request('https://app.test/x'), { params: Promise.resolve({ token: 'short', paymentId: '6f1c2a54-1b2c-4d5e-8f90-123456789abc' }) });
  assert.equal(bad.status, 404);
  const badId = await getProof(new Request('https://app.test/x'), { params: Promise.resolve({ token: 'long-enough-token', paymentId: '../../etc' }) });
  assert.equal(badId.status, 404);
  const badContract = await getContract(new Request('https://app.test/x'), { params: Promise.resolve({ token: 'short' }) });
  assert.equal(badContract.status, 404);
});

test('comprovante com URL externa (informada pelo admin) mantém o link direto', () => {
  const id = '6f1c2a54-1b2c-4d5e-8f90-123456789abc';
  assert.equal(buildPaymentProofHref('tok-12345678', { id, proof_file_url: 'https://banco.example/comprovante/1' }), 'https://banco.example/comprovante/1');
  assert.equal(buildPaymentProofHref('tok-12345678', { id, proof_file_url: 'https://x.supabase.co/storage/v1/object/public/payment-proofs/a.pdf' }), `/api/public/files/payment-proof/tok-12345678/${id}`);
  assert.equal(buildPaymentProofHref('tok-12345678', { id, proof_file_url: 'workspaces/ws/events/ev/payments/a.pdf' }), `/api/public/files/payment-proof/tok-12345678/${id}`);
  assert.equal(buildPaymentProofHref('tok-12345678', { id, proof_file_url: '' }), '');
});

test('PDF de contrato: Google vai pelo endpoint (redireciona); outra URL externa mantém o link direto', () => {
  assert.equal(buildContractPdfHref({ pdf_url: 'https://drive.google.com/file/d/x/view', public_token: 'ctr-token-123' }, { baseUrl: '' }), '/api/public/files/contract/ctr-token-123');
  assert.equal(buildContractPdfHref({ pdf_url: 'https://servico.example/c.pdf', public_token: 'ctr-token-123' }, { baseUrl: '' }), 'https://servico.example/c.pdf');
});
