import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'service-role-test-key';

const { assertRowInWorkspace, isInternalRequest, guardDebugRoute } = await import('../lib/api/route-guards.js');

function fakeSupabase(rows) {
  return {
    from(table) {
      const filters = {};
      const query = {
        select() { return query; },
        eq(column, value) { filters[column] = value; return query; },
        async maybeSingle() {
          const row = (rows[table] || []).find((item) => String(item.id) === String(filters.id));
          return { data: row || null, error: null };
        },
      };
      return query;
    },
  };
}

const db = fakeSupabase({
  contracts: [
    { id: 'c-a', workspace_id: 'ws-a' },
    { id: 'c-b', workspace_id: 'ws-b' },
  ],
});

test('IDOR: workspace A não acessa contrato do workspace B (404)', async () => {
  const result = await assertRowInWorkspace({ supabase: db, table: 'contracts', id: 'c-b', workspaceId: 'ws-a' });
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 404);
});

test('workspace A acessa o próprio contrato', async () => {
  const result = await assertRowInWorkspace({ supabase: db, table: 'contracts', id: 'c-a', workspaceId: 'ws-a' });
  assert.equal(result.ok, true);
});

test('ID inexistente e workspace ausente retornam 404 (fail-closed)', async () => {
  assert.equal((await assertRowInWorkspace({ supabase: db, table: 'contracts', id: 'nope', workspaceId: 'ws-a' })).ok, false);
  assert.equal((await assertRowInWorkspace({ supabase: db, table: 'contracts', id: 'c-a', workspaceId: null })).ok, false);
});

test('chamada interna exige INTERNAL_API_KEY configurada e igual', () => {
  const req = (key) => new Request('https://app.test/api/x', { headers: key ? { 'x-internal-key': key } : {} });
  delete process.env.INTERNAL_API_KEY;
  assert.equal(isInternalRequest(req('anything')), false, 'sem variável configurada nada é interno');
  process.env.INTERNAL_API_KEY = 'secret-123';
  assert.equal(isInternalRequest(req('secret-123')), true);
  assert.equal(isInternalRequest(req('secret-124')), false);
  assert.equal(isInternalRequest(req('')), false);
});

test('rotas de debug respondem 404 sem ENABLE_DEBUG_ROUTES', async () => {
  delete process.env.ENABLE_DEBUG_ROUTES;
  const result = await guardDebugRoute(new Request('https://app.test/api/debug/full'));
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 404);
});
