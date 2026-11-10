// "Reiniciar teste da Nara" pela rota REAL, em Postgres local descartável. Dados 100% sintéticos.
// Rodar: ./supabase/local/run-ai-inbox.sh (usa --import ./supabase/local/panel/register.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from './panel/server.mjs';
import { panelPool as pool } from './panel/supabase-admin.stub.mjs';

const WS = process.env.PANEL_WORKSPACE_ID;
const sql = async (q, p) => (await pool.query(q, p)).rows;
const call = async (method, path, body, auth = 'owner') => {
  const out = await handle(method, path, '', body ? JSON.stringify(body) : undefined, { 'content-type': 'application/json', 'x-test-auth': auth });
  return { status: out.status, body: JSON.parse(out.body || '{}') };
};
const TEST_CHAT = '550000000001';
const OTHER_CHAT = '550000000002';
const ingest = async (chat, msgId, text) => (await sql(
  "select * from ai_ingest_message($1, $2, $3, 'inbound', 'customer', 'text', $4)", [WS, chat, msgId, text]))[0];
let conv; let other;

test.before(async () => {
  await sql('delete from workspaces where id = $1', [WS]);
  await sql("insert into workspaces (id, key, name, slug) values ($1, 'ws-reset', 'Workspace Reset Teste', 'ws-reset')", [WS]);
  await sql("insert into ai_workspace_settings (workspace_id, ai_enabled, mode, assistant_name) values ($1, true, 'auto', 'Assistente Teste')", [WS]);
  await sql("insert into ai_channels (workspace_id, phone_number_id, display_phone, status, coexistence) values ($1, 'pn-teste', '+1 555-000-0000', 'active', false)", [WS]);
  await sql("insert into quote_price_rules (workspace_id, category, item_key, label, amount, valid_from) values ($1, 'ceremony', 'trio', 'Trio', 1500, '2090-01-01')", [WS]);
  conv = (await ingest(TEST_CHAT, 'm-1', 'Oi')).conversation_id;
  other = (await ingest(OTHER_CHAT, 'm-2', 'Olá')).conversation_id;
  await sql("update ai_conversations set lead_data = '{\"nome\":\"Cliente Teste\",\"orcamento\":\"apertado\"}', objections = '{price}' where id = $1", [conv]);
  await sql("insert into ai_memory_events (workspace_id, conversation_id, op, key, new_value) values ($1, $2, 'ADD', 'nome', 'Cliente Teste')", [WS, conv]);
  await sql(`insert into ai_message_outbox (workspace_id, conversation_id, sender_type, content, status, idempotency_key, owner_version)
    values ($1, $2, 'ai', 'resposta antiga pendente', 'pending', 'k-old-1', 1), ($1, $2, 'ai', 'rascunho antigo', 'draft', 'k-old-2', 1),
           ($1, $3, 'ai', 'resposta de outro contato', 'pending', 'k-other', 1)`, [WS, conv, other]);
});
test.after(async () => { await pool.end(); });

test('botão só no canal de teste; exige confirmação e admin', async () => {
  const detail = await call('GET', `/api/ai/conversations/${conv}`);
  assert.equal(detail.body.is_test_channel, true);
  assert.equal((await call('POST', `/api/ai/conversations/${conv}/reset-test`, {})).status, 400, 'sem confirmação');
  assert.equal((await call('POST', `/api/ai/conversations/${conv}/reset-test`, { confirm: 'REINICIAR' }, 'viewer')).status, 403, 'sem admin');
  await sql("update ai_channels set display_phone = '+55 71 3000-0000' where workspace_id = $1", [WS]);
  assert.equal((await call('GET', `/api/ai/conversations/${conv}`)).body.is_test_channel, false);
  assert.equal((await call('POST', `/api/ai/conversations/${conv}/reset-test`, { confirm: 'REINICIAR' })).status, 403, 'canal real: bloqueado');
  await sql("update ai_channels set display_phone = '+1 555-000-0000' where workspace_id = $1", [WS]);
  assert.equal((await sql('select count(*)::int n from ai_conversations where workspace_id = $1', [WS]))[0].n, 2, 'nada apagado nas tentativas negadas');
});

test('reinicia só o contato de teste: histórico, memória e pendências somem; resto preservado', async () => {
  const res = await call('POST', `/api/ai/conversations/${conv}/reset-test`, { confirm: 'REINICIAR' });
  assert.deepEqual([res.status, res.body.ok, res.body.deleted], [200, true, 1]);
  for (const t of ['ai_conversations', 'ai_messages', 'ai_memory_events', 'ai_message_outbox']) {
    const col = t === 'ai_conversations' ? 'id' : 'conversation_id';
    assert.equal((await sql(`select count(*)::int n from ${t} where ${col} = $1`, [conv]))[0].n, 0, `${t} do teste apagado`);
  }
  const claimed = await sql('select * from ai_claim_outbox(10, 60, $1)', [WS]);
  assert.ok(!claimed.some((c) => /antig/.test(c.content)), 'nenhuma resposta antiga pode ser despachada');
  assert.equal((await sql('select count(*)::int n from ai_conversations where id = $1', [other]))[0].n, 1, 'outro contato intacto');
  assert.equal((await sql("select count(*)::int n from ai_message_outbox where conversation_id = $1", [other]))[0].n, 1, 'fila do outro contato intacta');
  assert.equal((await sql("select count(*)::int n from quote_price_rules where workspace_id = $1", [WS]))[0].n, 1, 'tabelas preservadas');
  const [s] = await sql('select ai_enabled, mode from ai_workspace_settings where workspace_id = $1', [WS]);
  assert.deepEqual([s.ai_enabled, s.mode], [true, 'auto'], 'configurações preservadas');
});

test('próxima mensagem começa como primeiro atendimento, sem memória antiga', async () => {
  const fresh = await ingest(TEST_CHAT, 'm-3', 'Oi de novo');
  assert.notEqual(fresh.conversation_id, conv);
  const [c] = await sql('select owner, lead_data, objections from ai_conversations where id = $1', [fresh.conversation_id]);
  assert.equal(c.owner, 'ai');
  assert.deepEqual(c.lead_data, {});
  assert.deepEqual(c.objections || [], []);
  const msgs = await sql('select direction from ai_messages where conversation_id = $1', [fresh.conversation_id]);
  assert.deepEqual(msgs.map((m) => m.direction), ['inbound'], 'sem resposta anterior da IA => primeiro atendimento');
});
