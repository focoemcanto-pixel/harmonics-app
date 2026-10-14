import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'service-role-test-key';

const { extractContractStoragePath } = await import('../lib/contracts/contract-storage.js');

test('URL do Google Drive não é tratada como objeto do storage (redireciona para o link original)', () => {
  const parsed = extractContractStoragePath('https://drive.google.com/file/d/abc123/view?usp=drivesdk');
  assert.ok(!(parsed.bucket && parsed.path));
});

test('URL pública do storage é reconhecida', () => {
  const parsed = extractContractStoragePath('https://x.supabase.co/storage/v1/object/public/contract-pdfs/ws/file.pdf');
  assert.equal(parsed.bucket, 'contract-pdfs');
  assert.ok(parsed.path.endsWith('file.pdf'));
});
