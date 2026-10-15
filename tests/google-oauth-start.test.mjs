import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'service-role-test-key';

const { POST } = await import('../app/api/google/oauth/start/route.js');

test('início do OAuth Google sem sessão é negado, mesmo informando userId na query', async () => {
  const response = await POST(new Request('https://app.test/api/google/oauth/start?userId=00000000-0000-0000-0000-000000000001', { method: 'POST' }));
  assert.equal(response.status, 401);
});
