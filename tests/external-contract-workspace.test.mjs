import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { saveExternalContractForEvent } from '../lib/contracts/external-contract-flow.js';

const routeSource = readFileSync(
  new URL('../app/api/events/[id]/external-contract/route.js', import.meta.url),
  'utf8'
);

function fakeSupabase() {
  const state = {
    storageCalls: 0,
    insertedContract: null,
  };

  const storageBucket = {
    async upload() {
      state.storageCalls += 1;
      return { error: null };
    },
    getPublicUrl(path) {
      return { data: { publicUrl: `https://storage.test/${path}` } };
    },
  };

  function queryFor(table) {
    const filters = {};
    const query = {
      select() { return query; },
      eq(column, value) { filters[column] = value; return query; },
      order() { return query; },
      limit() { return query; },
      async maybeSingle() {
        if (table === 'contracts') return { data: null, error: null };
        if (table === 'repertoire_config') return { data: null, error: null };
        return { data: null, error: null };
      },
      update() { return query; },
    };
    return query;
  }

  const supabase = {
    storage: {
      async listBuckets() {
        state.storageCalls += 1;
        return { data: [{ name: 'contract-pdfs' }], error: null };
      },
      from() {
        return storageBucket;
      },
    },
    from(table) {
      if (table === 'contracts') {
        const query = queryFor(table);
        query.insert = (payload) => {
          state.insertedContract = payload;
          return {
            select() {
              return {
                async single() {
                  return { data: { id: 'contract-1', ...payload }, error: null };
                },
              };
            },
          };
        };
        return query;
      }

      if (table === 'repertoire_config') {
        const query = queryFor(table);
        query.insert = async () => ({ error: null });
        return query;
      }

      return queryFor(table);
    },
  };

  return { supabase, state };
}

test('rota de upload manual propaga o workspace autenticado para o fluxo externo', () => {
  assert.match(routeSource, /workspaceId:\s*auth\.workspaceId/);
  assert.match(routeSource, /\.eq\('workspace_id',\s*auth\.workspaceId\)/);
});

test('contrato externo sem workspace falha antes de tocar no Storage', async () => {
  const { supabase, state } = fakeSupabase();
  const file = { async arrayBuffer() { return new ArrayBuffer(1); } };

  await assert.rejects(
    () => saveExternalContractForEvent({ supabase, eventId: 'event-1', file }),
    /workspaceId é obrigatório para anexar contrato externo/
  );
  assert.equal(state.storageCalls, 0);
  assert.equal(state.insertedContract, null);
});

test('primeiro contrato externo recebe workspace_id explícito', async () => {
  const { supabase, state } = fakeSupabase();
  const file = { async arrayBuffer() { return new ArrayBuffer(1); } };

  const result = await saveExternalContractForEvent({
    supabase,
    workspaceId: 'workspace-a',
    eventId: 'event-1',
    file,
    contactId: 'contact-1',
  });

  assert.equal(result.contract.workspace_id, 'workspace-a');
  assert.equal(state.insertedContract.workspace_id, 'workspace-a');
  assert.equal(state.insertedContract.event_id, 'event-1');
  assert.equal(state.insertedContract.contact_id, 'contact-1');
  assert.ok(state.storageCalls >= 2);
});
