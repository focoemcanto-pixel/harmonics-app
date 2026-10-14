import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeSupabase } from './helpers/fake-supabase.mjs';

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'service-role-test-key';

const { bootstrapWorkspaceForUser, findExistingWorkspaceForUser } = await import('../lib/workspaces/bootstrap-workspace.js');

function db() {
  return createFakeSupabase({
    tables: { workspaces: [], workspace_members: [], workspace_settings: [], workspace_subscriptions: [] },
    unique: { workspaces: ['owner_user_id', 'slug'] },
  });
}

test('primeiro bootstrap cria workspace com owner_user_id e membership owner', async () => {
  const supabase = db();
  const result = await bootstrapWorkspaceForUser({ supabase, userId: 'u1', workspaceName: 'Banda Um' });
  assert.equal(result.ok, true);
  assert.equal(result.workspace.owner_user_id, 'u1');
  assert.equal(supabase.stats.inserts.workspaces, 1);
  const existing = await findExistingWorkspaceForUser({ supabase, userId: 'u1' });
  assert.equal(existing.workspace.id, result.workspace.id);
});

test('retry/corrida: segundo bootstrap do mesmo usuário não cria outro workspace', async () => {
  const supabase = db();
  const first = await bootstrapWorkspaceForUser({ supabase, userId: 'u1', workspaceName: 'Banda Um' });
  const second = await bootstrapWorkspaceForUser({ supabase, userId: 'u1', workspaceName: 'Banda Um (clique 2)' });
  assert.equal(second.workspace.id, first.workspace.id);
  assert.equal(supabase.stats.inserts.workspaces, 1, 'apenas um workspace persistido');
  const memberships = await supabase.from('workspace_members').select('*').eq('user_id', 'u1');
  assert.equal(memberships.data.length, 1, 'apenas uma membership');
});

test('usuários diferentes recebem workspaces diferentes', async () => {
  const supabase = db();
  const a = await bootstrapWorkspaceForUser({ supabase, userId: 'u1', workspaceName: 'Mesma Banda' });
  const b = await bootstrapWorkspaceForUser({ supabase, userId: 'u2', workspaceName: 'Mesma Banda' });
  assert.notEqual(a.workspace.id, b.workspace.id);
  assert.notEqual(a.workspace.slug, b.workspace.slug);
});
