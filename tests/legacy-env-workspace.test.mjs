import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'service-role-test-key';
delete process.env.LEGACY_ENV_WORKSPACE_ID;

const { isLegacyEnvWorkspace } = await import('../lib/whatsapp/legacy-env-workspace.js');

test('Harmonics é sempre o workspace legado do WhatsApp, mesmo sem consultar o banco', async () => {
  assert.equal(await isLegacyEnvWorkspace('f36dcd9b-22a9-487a-bf2e-691d17bd6294'), true);
  assert.equal(await isLegacyEnvWorkspace(''), false);
});
