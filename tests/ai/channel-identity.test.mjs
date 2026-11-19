// Identidade de canal e proteção contra diagnósticos Meta defasados.
// Exclusivamente dados sintéticos: nenhuma mensagem real e nenhuma credencial.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  channelIdentityChanged,
  prepareChannelIdentityUpdate,
  nextChannelRevision,
  updateChannelIfCurrent,
} from '../../lib/ai/inbox/channel-identity.mjs';

const base = () => ({
  id: 'channel-synthetic',
  workspace_id: 'workspace-synthetic',
  provider: 'meta_cloud',
  phone_number_id: '111222333444',
  waba_id: '555666',
  display_phone: '+55 (71) 99999-1111',
  access_token_encrypted: 'encrypted-token-A',
  last_eligibility: { ok: true, isOnBizApp: true },
  coexistence: true,
  history_sync_status: 'completed',
  last_webhook_at: '2026-11-19T10:00:00.000Z',
  updated_at: '2026-11-19T13:00:00.000Z',
  status: 'active',
});

test('mesmos IDs e formatação equivalente preservam diagnóstico legítimo', () => {
  const old = base();
  const changes = { phone_number_id: old.phone_number_id, waba_id: old.waba_id,
    display_phone: '55 71 99999 1111', status: 'active' };
  assert.equal(channelIdentityChanged(old, changes), false);
  assert.deepEqual(prepareChannelIdentityUpdate({ existing: old, fields: changes }), {
    identityChanged: false,
    fields: changes,
  });
});

for (const [label, change, tokenRotated] of [
  ['Phone Number ID', { phone_number_id: '999888777666' }, false],
  ['WABA ID', { waba_id: '999888' }, false],
  ['número exibido', { display_phone: '+55 71 90000-2222' }, false],
  ['token rotacionado', {}, true],
]) {
  test(`mudança de ${label} invalida verificação e pausa o canal`, () => {
    const old = base();
    const { identityChanged, fields } = prepareChannelIdentityUpdate({
      existing: old, fields: { ...change, status: 'active' }, tokenRotated,
    });
    assert.equal(identityChanged, true);
    assert.equal(fields.status, 'paused');
    assert.equal(fields.coexistence, false);
    assert.equal(fields.last_eligibility, null);
    assert.equal(fields.last_webhook_at, null);
    assert.equal(fields.history_sync_status, 'not_requested');
  });
}

test('novo canal também começa sem verificação e sem envio', () => {
  const { fields } = prepareChannelIdentityUpdate({
    fields: { phone_number_id: '999888777', status: 'active', coexistence: true },
  });
  assert.equal(fields.status, 'paused');
  assert.equal(fields.coexistence, false);
  assert.equal(fields.last_eligibility, null);
});

test('revisão avança mesmo em atualizações no mesmo milissegundo', () => {
  const revision = nextChannelRevision('2026-11-19T13:00:00.000Z', Date.parse('2026-11-19T13:00:00.000Z'));
  assert.equal(revision, '2026-11-19T13:00:00.001Z');
});

function syntheticDb(initial = base()) {
  const row = { ...initial };
  const client = {
    from: (table) => {
      assert.equal(table, 'ai_channels');
      let patch = null;
      const conditions = [];
      const query = {
        update(value) { patch = value; return query; },
        eq(key, value) { conditions.push([key, value]); return query; },
        select(columns) { assert.equal(columns, 'id'); return query; },
        async maybeSingle() {
          const matches = conditions.every(([key, value]) => row[key] === value);
          if (!matches) return { data: null, error: null };
          Object.assign(row, patch);
          return { data: { id: row.id }, error: null };
        },
      };
      return query;
    },
  };
  return { row, client };
}

test('consulta Meta em voo não pode revalidar número já trocado', async () => {
  const { row, client } = syntheticDb();
  const before = { ...row };
  const change = prepareChannelIdentityUpdate({
    existing: before, fields: { phone_number_id: 'phone-updated' },
  });
  const save = await updateChannelIfCurrent({
    supabase: client, workspaceId: before.workspace_id, channel: before, changes: change.fields,
  });
  assert.equal(save.data.id, before.id);

  const outdated = await updateChannelIfCurrent({
    supabase: client, workspaceId: before.workspace_id, channel: before,
    changes: { last_eligibility: { ok: true, isOnBizApp: true }, coexistence: true },
    matchPhone: true,
  });
  assert.equal(outdated.data, null, 'CAS cancela resultado Meta antigo');
  assert.equal(row.phone_number_id, 'phone-updated');
  assert.equal(row.coexistence, false);
  assert.equal(row.last_eligibility, null);
  assert.equal(row.status, 'paused');
});

test('consulta Meta em voo não pode revalidar token rotacionado com mesmo Phone Number ID', async () => {
  const { row, client } = syntheticDb();
  const before = { ...row };
  const change = prepareChannelIdentityUpdate({
    existing: before,
    fields: { access_token_encrypted: 'encrypted-token-B' },
    tokenRotated: true,
  });
  await updateChannelIfCurrent({
    supabase: client, workspaceId: before.workspace_id, channel: before, changes: change.fields,
  });
  const oldResult = await updateChannelIfCurrent({
    supabase: client, workspaceId: before.workspace_id, channel: before,
    changes: { last_eligibility: { ok: true, isOnBizApp: true }, coexistence: true },
    matchPhone: true,
  });
  assert.equal(oldResult.data, null);
  assert.equal(row.access_token_encrypted, 'encrypted-token-B');
  assert.equal(row.coexistence, false);
});

test('duas consultas simultâneas não sobrescrevem diagnóstico mais recente', async () => {
  const { row, client } = syntheticDb();
  const snapshot = { ...row };
  const first = await updateChannelIfCurrent({
    supabase: client, workspaceId: snapshot.workspace_id, channel: snapshot,
    changes: { last_eligibility: { ok: true, isOnBizApp: false }, coexistence: false },
    matchPhone: true,
  });
  assert.ok(first.data);
  const old = await updateChannelIfCurrent({
    supabase: client, workspaceId: snapshot.workspace_id, channel: snapshot,
    changes: { last_eligibility: { ok: true, isOnBizApp: true }, coexistence: true },
    matchPhone: true,
  });
  assert.equal(old.data, null);
  assert.equal(row.coexistence, false);
});

test('workspace diferente não consegue modificar o canal', async () => {
  const { row, client } = syntheticDb();
  const result = await updateChannelIfCurrent({
    supabase: client, workspaceId: 'workspace-other', channel: { ...row },
    changes: { coexistence: true }, matchPhone: true,
  });
  assert.equal(result.data, null);
});
