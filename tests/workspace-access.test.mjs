import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeSupabase } from './helpers/fake-supabase.mjs';

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'service-role-test-key';

const { requireWorkspaceAccess, requireWorkspaceAdmin } = await import('../lib/api/require-workspace-access.js');

function world() {
  return createFakeSupabase({
    users: { 'tok-a': { id: 'user-a', email: 'a@test' }, 'tok-b': { id: 'user-b', email: 'b@test' }, 'tok-x': { id: 'user-x', email: 'x@test' } },
    tables: {
      profiles: [
        { id: 'user-a', role: 'member' },
        { id: 'user-b', role: 'member' },
        { id: 'user-x', role: 'member' },
      ],
      workspaces: [
        { id: 'ws-a', name: 'A', slug: 'a', key: 'a', status: 'active', plan_key: 'free' },
        { id: 'ws-b', name: 'B', slug: 'b', key: 'b', status: 'active', plan_key: 'free' },
      ],
      workspace_members: [
        { id: 'm-a', workspace_id: 'ws-a', user_id: 'user-a', role: 'owner', status: 'active' },
        { id: 'm-b', workspace_id: 'ws-b', user_id: 'user-b', role: 'viewer', status: 'active' },
      ],
      workspace_settings: [{ id: 's-a', workspace_id: 'ws-a' }],
    },
  });
}

const req = (token, headers = {}) => new Request('https://app.test/api/x', { headers: { authorization: `Bearer ${token}`, ...headers } });

test('membro resolve o próprio workspace com 1 chamada ao Auth e ≤ 5 consultas', async () => {
  const supabase = world();
  const auth = await requireWorkspaceAccess({ supabase, request: req('tok-a') });
  assert.equal(auth.ok, true);
  assert.equal(auth.workspaceId, 'ws-a');
  assert.equal(auth.role, 'owner');
  assert.equal(supabase.stats.getUser, 1, 'auth.getUser deve rodar uma única vez');
  assert.ok(supabase.stats.from <= 5, `consultas: ${supabase.stats.from} ${JSON.stringify(supabase.stats.byTable)}`);
});

test('IDOR: usuário A pedindo workspace B via header continua no próprio workspace', async () => {
  const supabase = world();
  const auth = await requireWorkspaceAccess({ supabase, request: req('tok-a', { 'x-workspace-id': 'ws-b' }) });
  assert.equal(auth.ok, true);
  assert.equal(auth.workspaceId, 'ws-a');
});

test('usuário sem membership é negado', async () => {
  const auth = await requireWorkspaceAccess({ supabase: world(), request: req('tok-x') });
  assert.equal(auth.ok, false);
  assert.equal(auth.status, 403);
});

test('token inválido → 401', async () => {
  const auth = await requireWorkspaceAccess({ supabase: world(), request: req('nope') });
  assert.equal(auth.ok, false);
  assert.equal(auth.status, 401);
});

test('viewer não passa em requireWorkspaceAdmin; owner passa', async () => {
  assert.equal((await requireWorkspaceAdmin({ supabase: world(), request: req('tok-b') })).status, 403);
  assert.equal((await requireWorkspaceAdmin({ supabase: world(), request: req('tok-a') })).ok, true);
});
