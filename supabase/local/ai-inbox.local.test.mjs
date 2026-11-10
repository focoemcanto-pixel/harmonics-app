// Inbox híbrido em Postgres LOCAL descartável (schema real + migrations AI v1/v2).
// Executa o código real do app (ingestão de webhook, IA, fila transacional, despacho) com
// Meta e LLM FALSOS. Prova: deduplicação, transferência IA↔humano atômica, corrida
// geração×takeover, claim concorrente sem envio duplicado, kill switch, isolamento entre
// workspaces, RLS/privilégios, reconciliação e LGPD. Dados 100% sintéticos.
//
// Rodar: ./supabase/local/run-ai-inbox.sh
import test from 'node:test';
import { semanticLlm } from '../../tests/helpers/semantic-llm.mjs';
import assert from 'node:assert/strict';
import { createPgSupabase } from './pg-supabase.mjs';
import { encryptSecret } from '../../lib/ai/inbox/secret-box.mjs';
import { ingestWebhook, processConversationReply, dispatchOutbox, runInboxCycle } from '../../lib/ai/inbox/service.mjs';

const DB_URL = process.env.LOCAL_DB_URL || 'postgresql://postgres@localhost/harmonics_local?host=/tmp&port=54329';
const parsed = new URL(DB_URL);
const host = parsed.searchParams.get('host') || parsed.hostname;
if (decodeURIComponent(parsed.pathname.slice(1)) !== 'harmonics_local' || !['/tmp', 'localhost', '127.0.0.1'].includes(host)) {
  throw new Error('ai-inbox.local: recusado — use somente o banco descartável harmonics_local local.');
}
const pg = (await import(process.env.PG_MODULE || 'pg')).default;
const pool = new pg.Pool({ connectionString: DB_URL, max: 12 });
const service = createPgSupabase({ pool, role: 'service_role' });
const asUser = createPgSupabase({ pool, role: 'authenticated', sub: '00000000-0000-4000-8000-0000000000aa' });
const anon = createPgSupabase({ pool, role: 'anon' });

const KEY = Buffer.alloc(32, 3).toString('base64');
const ENV = { AI_INBOX_AI_ENABLED: 'true', OPENAI_API_KEY: 'sk-test', AI_CHANNEL_ENCRYPTION_KEY: KEY };
const WS_A = '00000000-0000-4000-8000-00000000000a';
const WS_B = '00000000-0000-4000-8000-00000000000b';
const PN_A = '900000000001';
const PN_B = '900000000002';
const CUSTOMER = '15550001001';

let counter = 0;
const id = (prefix) => `${prefix}.${Date.now()}.${(counter += 1)}`;

function webhook(field, value, phoneNumberId = PN_A) {
  return { object: 'whatsapp_business_account', entry: [{ id: 'waba-synthetic', changes: [{ field, value: { metadata: { phone_number_id: phoneNumberId, display_phone_number: '15550000000' }, ...value } }] }] };
}
const customerMsg = (text, { chat = CUSTOMER, msgId = id('wamid.in'), pn = PN_A } = {}) => webhook('messages', {
  contacts: [{ wa_id: chat, profile: { name: 'Cliente Sintético' } }],
  messages: [{ from: chat, id: msgId, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: text } }],
}, pn);

async function deliver(payload) {
  const rawBody = JSON.stringify(payload);
  return ingestWebhook({ supabase: service, rawBody, payload });
}

function fakeMeta() {
  const sent = [];
  return {
    sent,
    sendTextMessage: async ({ to, text }) => {
      await new Promise((r) => setTimeout(r, 15));
      const providerMessageId = id('wamid.out');
      sent.push({ to, text, providerMessageId });
      return { status: 'sent', providerMessageId };
    },
  };
}

function deps(extra = {}) {
  const meta = fakeMeta();
  const config = {
    env: ENV,
    sendTextMessage: meta.sendTextMessage,
    generateReply: async ({ executeTool }) => {
      await executeTool('registrar_dados_evento', { tipo_evento: 'casamento' });
      await executeTool('consultar_precos', { formacao: 'Trio', local: 'Cidade Base Teste' });
      return { text: 'Oi! Sou a assistente virtual. Veja a referência para o Trio:', model: 'fake', inputTokens: 100, outputTokens: 20, costUsd: 0.0001, toolCalls: ['consultar_precos'] };
    },
    ...extra,
  };
  config.generateReply = semanticLlm(config.generateReply);
  return { meta, deps: config };
}

async function sql(text, params) {
  const { rows } = await pool.query(text, params);
  return rows;
}

async function conversationOf(chat = CUSTOMER, ws = WS_A) {
  const [row] = await sql('select * from ai_conversations where workspace_id = $1 and provider_chat_id = $2', [ws, chat]);
  return row;
}

test.before(async () => {
  await sql('truncate ai_webhook_events, ai_usage_ledger, ai_approvals, ai_channels, ai_workspace_settings, ai_conversations cascade');
  await sql("delete from pricing_settings where workspace_id = any($1)", [[WS_A, WS_B]]);
  await sql("delete from workspaces where id = any($1)", [[WS_A, WS_B]]);
  await sql("insert into workspaces (id, key, name, slug) values ($1, 'ws-a-test', 'Workspace A Teste', 'ws-a-test'), ($2, 'ws-b-test', 'Workspace B Teste', 'ws-b-test')", [WS_A, WS_B]);
  const token = await encryptSecret('token-sintetico-para-testes-0001', KEY);
  await sql("insert into ai_channels (workspace_id, phone_number_id, access_token_encrypted, status) values ($1, $2, $3, 'active'), ($4, $5, $3, 'active')", [WS_A, PN_A, token, WS_B, PN_B]);
  await sql("insert into ai_workspace_settings (workspace_id, ai_enabled, mode) values ($1, true, 'auto'), ($2, false, 'observe')", [WS_A, WS_B]);
  await sql("insert into pricing_settings (slug, workspace_id, price_trio) values ('ws-test-a', $1, 2500)", [WS_A]);
  await sql("insert into ai_service_areas (workspace_id, name, status, match_terms, active) values ($1, 'Cidade Base Teste', 'served', '{cidade base teste}', true)", [WS_A]);
});

test.after(async () => { await pool.end(); });

test('privilégios: anon e authenticated não leem tabelas nem executam RPCs da IA', async () => {
  for (const client of [anon, asUser]) {
    const read = await client.from('ai_conversations').select('id');
    assert.ok(read.error, 'leitura deve ser negada');
    const rpc = await client.rpc('ai_switch_conversation_owner', { p_workspace_id: WS_A, p_conversation_id: WS_A, p_to_owner: 'ai' });
    assert.ok(rpc.error, 'RPC deve ser negada');
  }
});

test('ingestão idempotente: mesmo webhook e mesma mensagem não duplicam', async () => {
  const payload = customerMsg('Olá! Vocês fazem casamento?');
  const first = await deliver(payload);
  assert.equal(first.duplicate, false);
  assert.equal(first.pending.length, 1, 'IA ligada em auto => conversa nova nasce com a IA');
  const again = await deliver(payload);
  assert.equal(again.duplicate, true);
  // Mesmo ID de mensagem com outro corpo (reentrega diferente) também não duplica.
  const msgId = payload.entry[0].changes[0].value.messages[0].id;
  const variant = customerMsg('Olá! Vocês fazem casamento?', { msgId });
  variant.entry[0].id = 'waba-other';
  const third = await deliver(variant);
  assert.equal(third.stats.duplicates, 1);
  const [{ n }] = await sql('select count(*)::int n from ai_messages where provider_message_id = $1', [msgId]);
  assert.equal(n, 1);
  const conv = await conversationOf();
  assert.deepEqual([conv.owner, conv.ai_enabled, conv.unread_count, conv.contact_name], ['ai', true, 1, 'Cliente Sintético']);
});

test('IA responde com dados reais do workspace, enfileira e despacha uma vez', async () => {
  const { meta, deps: d } = deps();
  const conv = await conversationOf();
  await sql("update ai_conversations set ai_pending_since = now() - interval '10 seconds' where id = $1", [conv.id]);
  const result = await processConversationReply({ supabase: service, workspaceId: WS_A, conversationId: conv.id, deps: d });
  assert.equal(result.status, 'pending');
  const sent = await dispatchOutbox({ supabase: service, workspaceId: WS_A, deps: d });
  assert.deepEqual(sent.map((s) => s.status), ['sent']);
  assert.match(meta.sent[0].text, /R\$ 2\.500/, 'preço vem de pricing_settings do workspace');
  const [out] = await sql("select * from ai_messages where conversation_id = $1 and direction = 'outbound'", [conv.id]);
  assert.deepEqual([out.sender_type, out.origin], ['ai', 'api_ai']);
  const lead = (await conversationOf()).lead_data;
  assert.equal(lead.tipo_evento, 'casamento', 'memória da conversa persistida');
  const [{ n }] = await sql("select count(*)::int n from ai_usage_ledger where workspace_id = $1 and kind = 'reply'", [WS_A]);
  assert.equal(n, 1, 'custo registrado');
  // Reprocessar não gera nova resposta para a mesma mensagem.
  await sql("update ai_conversations set ai_pending_since = now() - interval '10 seconds' where id = $1", [conv.id]);
  const repeat = await processConversationReply({ supabase: service, workspaceId: WS_A, conversationId: conv.id, deps: d });
  assert.equal(repeat.status, 'duplicate');
});

test('eco do app WhatsApp Business transfere para humano e cancela fila da IA na mesma transação', async () => {
  const conv = await conversationOf();
  await sql("insert into ai_message_outbox (workspace_id, conversation_id, owner_version, idempotency_key, content, status, sender_type) values ($1, $2, $3, $4, 'resposta IA pendente', 'pending', 'ai')", [WS_A, conv.id, conv.owner_version, id('k')]);
  const echo = webhook('smb_message_echoes', { message_echoes: [{ from: '15550000000', to: CUSTOMER, id: id('wamid.echo'), timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: 'Oi, aqui é a equipe!' } }] });
  const res = await deliver(echo);
  assert.equal(res.stats.takeovers, 1);
  const after = await conversationOf();
  assert.equal(after.owner, 'human');
  assert.equal(Number(after.owner_version), Number(conv.owner_version) + 1);
  const pending = await sql("select status from ai_message_outbox where conversation_id = $1 and sender_type = 'ai' and content = 'resposta IA pendente'", [conv.id]);
  assert.equal(pending[0].status, 'cancelled');
  const [handoff] = await sql('select reason from ai_handoffs where conversation_id = $1 order by created_at desc limit 1', [conv.id]);
  assert.equal(handoff.reason, 'business_app_reply');
  // Nova mensagem do cliente com humano no controle: IA não é acionada.
  const next = await deliver(customerMsg('Perfeito, obrigado!'));
  assert.equal(next.pending.length, 0);
});

test('eco de mensagem enviada pela própria API não gera falso takeover', async () => {
  const chat = '15550001009';
  await deliver(customerMsg('Oi', { chat }));
  const conv = await conversationOf(chat);
  await sql("insert into ai_message_outbox (workspace_id, conversation_id, owner_version, idempotency_key, content, status, sender_type, provider_message_id) values ($1, $2, $3, $4, 'x', 'sent', 'ai', 'wamid.api-own')", [WS_A, conv.id, conv.owner_version, id('k')]);
  await deliver(webhook('smb_message_echoes', { message_echoes: [{ to: chat, id: 'wamid.api-own', type: 'text', text: { body: 'x' } }] }));
  assert.equal((await conversationOf(chat)).owner, 'ai');
});

test('corrida: humano assume DURANTE a geração => resposta da IA é rejeitada e nada é enviado', async () => {
  const chat = '15550001002';
  await deliver(customerMsg('Quanto custa um trio?', { chat }));
  const conv = await conversationOf(chat);
  await sql("update ai_conversations set ai_pending_since = now() - interval '10 seconds' where id = $1", [conv.id]);
  const { meta, deps: d } = deps({
    generateReply: async () => {
      await service.rpc('ai_switch_conversation_owner', { p_workspace_id: WS_A, p_conversation_id: conv.id, p_to_owner: 'human', p_reason: 'manual', p_actor_user_id: null });
      return { text: 'Resposta que não pode sair', model: 'fake', inputTokens: 1, outputTokens: 1, costUsd: 0 };
    },
  });
  const result = await processConversationReply({ supabase: service, workspaceId: WS_A, conversationId: conv.id, deps: d });
  assert.equal(result.status, 'rejected');
  await dispatchOutbox({ supabase: service, workspaceId: WS_A, deps: d });
  assert.equal(meta.sent.length, 0);
});

test('corrida: versão antiga já enfileirada é cancelada no claim', async () => {
  const chat = '15550001003';
  await deliver(customerMsg('Oi', { chat }));
  const conv = await conversationOf(chat);
  await sql("insert into ai_message_outbox (workspace_id, conversation_id, owner_version, idempotency_key, content, status, sender_type) values ($1, $2, $3, $4, 'velha', 'pending', 'ai')", [WS_A, conv.id, Number(conv.owner_version) - 1, id('k')]);
  const { meta, deps: d } = deps();
  await dispatchOutbox({ supabase: service, workspaceId: WS_A, deps: d });
  assert.equal(meta.sent.length, 0);
  const [row] = await sql("select status, last_error from ai_message_outbox where content = 'velha'");
  assert.deepEqual([row.status, row.last_error], ['cancelled', 'owner_changed']);
});

test('concorrência: 4 workers paralelos enviam 20 mensagens exatamente uma vez', async () => {
  const chat = '15550001004';
  await deliver(customerMsg('Oi', { chat }));
  const conv = await conversationOf(chat);
  for (let i = 0; i < 20; i += 1) {
    const { error } = await service.rpc('ai_enqueue_human_message', { p_workspace_id: WS_A, p_conversation_id: conv.id, p_actor_user_id: null, p_idempotency_key: `human:test:${i}`, p_content: `msg ${i}` });
    assert.equal(error, null);
  }
  // Mesma chave de idempotência (duplo clique) não duplica.
  await service.rpc('ai_enqueue_human_message', { p_workspace_id: WS_A, p_conversation_id: conv.id, p_actor_user_id: null, p_idempotency_key: 'human:test:0', p_content: 'msg 0' });
  const { meta, deps: d } = deps();
  const results = await Promise.all([1, 2, 3, 4].map(() => dispatchOutbox({ supabase: service, workspaceId: WS_A, limit: 20, deps: d })));
  const total = results.flat();
  assert.equal(meta.sent.length, 20);
  assert.equal(new Set(meta.sent.map((s) => s.text)).size, 20, 'nenhuma mensagem enviada duas vezes');
  assert.equal(total.length, 20);
  assert.equal((await conversationOf(chat)).owner, 'human', 'mensagem humana assume a conversa');
});

test('concorrência: duas gerações simultâneas para a mesma conversa => só uma roda', async () => {
  const chat = '15550001005';
  await deliver(customerMsg('Oi, tudo bem?', { chat }));
  const conv = await conversationOf(chat);
  await sql("update ai_conversations set ai_pending_since = now() - interval '10 seconds' where id = $1", [conv.id]);
  let calls = 0;
  const { deps: d } = deps({
    generateReply: async () => { calls += 1; await new Promise((r) => setTimeout(r, 50)); return { text: 'Oi! Tudo ótimo, e com você?', model: 'fake', inputTokens: 1, outputTokens: 1, costUsd: 0 }; },
  });
  const results = await Promise.all([1, 2, 3].map(() => processConversationReply({ supabase: service, workspaceId: WS_A, conversationId: conv.id, deps: d })));
  assert.equal(calls, 1);
  assert.equal(results.filter((r) => r.status === 'pending').length, 1);
});

test('pedido de humano: mensagem de transição + needs_human e IA para de responder', async () => {
  const chat = '15550001006';
  await deliver(customerMsg('Quero falar com um atendente', { chat }));
  const conv = await conversationOf(chat);
  await sql("update ai_conversations set ai_pending_since = now() - interval '10 seconds' where id = $1", [conv.id]);
  const { meta, deps: d } = deps({ generateReply: async () => { throw new Error('não deveria chamar a IA'); } });
  const result = await processConversationReply({ supabase: service, workspaceId: WS_A, conversationId: conv.id, deps: d });
  assert.equal(result.status, 'handoff');
  await dispatchOutbox({ supabase: service, workspaceId: WS_A, deps: d });
  assert.match(meta.sent.find((s) => s.to === chat).text, /equipe/);
  assert.equal((await conversationOf(chat)).needs_human, true);
  await deliver(customerMsg('Alô?', { chat }));
  await sql("update ai_conversations set ai_pending_since = now() - interval '10 seconds' where id = $1", [conv.id]);
  const blocked = await processConversationReply({ supabase: service, workspaceId: WS_A, conversationId: conv.id, deps: d });
  assert.equal(blocked.reason, 'awaiting_human');
});

test('áudio é transcrito e entra no contexto da IA', async () => {
  const chat = '15550001007';
  await deliver(webhook('messages', { messages: [{ from: chat, id: id('wamid.audio'), timestamp: String(Math.floor(Date.now() / 1000)), type: 'audio', audio: { id: 'media-synthetic', mime_type: 'audio/ogg' } }] }));
  const conv = await conversationOf(chat);
  await sql("update ai_conversations set ai_pending_since = now() - interval '10 seconds' where id = $1", [conv.id]);
  let seen = null;
  const { deps: d } = deps({
    downloadMedia: async () => ({ bytes: new ArrayBuffer(10), mime: 'audio/ogg' }),
    transcribeAudio: async () => ({ text: 'queria orçamento para um aniversário', model: 'fake-stt', costUsd: 0.003 }),
    generateReply: async ({ input }) => { seen = input; return { text: 'Que legal! Para quando seria?', model: 'fake', inputTokens: 1, outputTokens: 1, costUsd: 0 }; },
  });
  await processConversationReply({ supabase: service, workspaceId: WS_A, conversationId: conv.id, deps: d });
  assert.match(seen.at(-1).content, /orçamento para um aniversário/);
  const [msg] = await sql("select transcript from ai_messages where conversation_id = $1 and message_type = 'audio'", [conv.id]);
  assert.match(msg.transcript, /aniversário/);
});

test('kill switch global: não gera e não envia resposta já enfileirada da IA', async () => {
  const chat = '15550001008';
  await deliver(customerMsg('Oi', { chat }));
  const conv = await conversationOf(chat);
  await service.rpc('ai_enqueue_ai_reply', { p_workspace_id: WS_A, p_conversation_id: conv.id, p_expected_owner_version: conv.owner_version, p_idempotency_key: id('k'), p_content: 'pendente', p_as_draft: false });
  await sql("update ai_conversations set ai_pending_since = now() - interval '10 seconds' where id = $1", [conv.id]);
  const { meta, deps: d } = deps({ env: { ...ENV, AI_INBOX_KILL_SWITCH: 'true' } });
  const result = await processConversationReply({ supabase: service, workspaceId: WS_A, conversationId: conv.id, deps: d });
  assert.equal(result.reason, 'global_kill_switch');
  const dispatched = await dispatchOutbox({ supabase: service, workspaceId: WS_A, deps: d });
  assert.equal(meta.sent.length, 0);
  assert.equal(dispatched[0].error, 'ai_gate_closed');
});

test('kill switch do workspace (ai_enabled=false) bloqueia o claim da IA no banco', async () => {
  const chat = '15550001010';
  await deliver(customerMsg('Oi', { chat }));
  const conv = await conversationOf(chat);
  await service.rpc('ai_enqueue_ai_reply', { p_workspace_id: WS_A, p_conversation_id: conv.id, p_expected_owner_version: conv.owner_version, p_idempotency_key: id('k'), p_content: 'bloqueada', p_as_draft: false });
  await sql('update ai_workspace_settings set ai_enabled = false where workspace_id = $1', [WS_A]);
  const { meta, deps: d } = deps();
  await dispatchOutbox({ supabase: service, workspaceId: WS_A, deps: d });
  assert.equal(meta.sent.length, 0);
  const [row] = await sql("select status from ai_message_outbox where content = 'bloqueada'");
  assert.equal(row.status, 'pending', 'permanece retida até religar ou humano assumir');
  await sql('update ai_workspace_settings set ai_enabled = true where workspace_id = $1', [WS_A]);
});

test('modo rascunho: IA sugere, humano aprova e envia como equipe', async () => {
  await sql("update ai_workspace_settings set mode = 'draft' where workspace_id = $1", [WS_A]);
  const chat = '15550001011';
  await deliver(customerMsg('Oi, quero um orçamento', { chat }));
  const conv = await conversationOf(chat);
  await sql("update ai_conversations set ai_pending_since = now() - interval '10 seconds' where id = $1", [conv.id]);
  const { meta, deps: d } = deps();
  const result = await processConversationReply({ supabase: service, workspaceId: WS_A, conversationId: conv.id, deps: d });
  assert.equal(result.status, 'draft');
  await dispatchOutbox({ supabase: service, workspaceId: WS_A, deps: d });
  assert.equal(meta.sent.length, 0, 'rascunho nunca sai sozinho');
  await service.rpc('ai_switch_conversation_owner', { p_workspace_id: WS_A, p_conversation_id: conv.id, p_to_owner: 'human', p_reason: 'draft_approved', p_actor_user_id: null });
  const [draft] = await sql("select id, status from ai_message_outbox where conversation_id = $1 and status = 'cancelled' and sender_type = 'ai'", [conv.id]);
  assert.ok(draft, 'troca de dono cancela rascunho da IA não aprovado');
  await sql("update ai_workspace_settings set mode = 'auto' where workspace_id = $1", [WS_A]);
});

test('aprovação de rascunho: o texto revisado é enviado pela equipe', async () => {
  await sql("update ai_workspace_settings set mode = 'draft' where workspace_id = $1", [WS_A]);
  const chat = '15550001012';
  await deliver(customerMsg('Oi', { chat }));
  const conv = await conversationOf(chat);
  const { data } = await service.rpc('ai_enqueue_ai_reply', { p_workspace_id: WS_A, p_conversation_id: conv.id, p_expected_owner_version: conv.owner_version, p_idempotency_key: id('k'), p_content: 'sugestão', p_as_draft: true });
  const draftId = data[0].outbox_id;
  await service.rpc('ai_approve_draft', { p_workspace_id: WS_A, p_outbox_id: draftId, p_actor_user_id: null, p_content: 'sugestão revisada' });
  await service.rpc('ai_switch_conversation_owner', { p_workspace_id: WS_A, p_conversation_id: conv.id, p_to_owner: 'human', p_reason: 'draft_approved', p_actor_user_id: null });
  const { meta, deps: d } = deps();
  await dispatchOutbox({ supabase: service, workspaceId: WS_A, deps: d });
  assert.deepEqual(meta.sent.map((s) => s.text), ['sugestão revisada']);
  await sql("update ai_workspace_settings set mode = 'auto' where workspace_id = $1", [WS_A]);
});

test('isolamento: número sem canal é ignorado; RPC com outro workspace não acessa a conversa', async () => {
  const unknown = await deliver(customerMsg('Oi', { pn: '999999999999' }));
  assert.equal(unknown.stats.ignored, 1);
  const conv = await conversationOf();
  const cross = await service.rpc('ai_switch_conversation_owner', { p_workspace_id: WS_B, p_conversation_id: conv.id, p_to_owner: 'ai', p_reason: 'x', p_actor_user_id: null });
  assert.equal(cross.error?.code, 'P0002');
  const crossDraft = await service.rpc('ai_approve_draft', { p_workspace_id: WS_B, p_outbox_id: conv.id, p_actor_user_id: null, p_content: null });
  assert.equal(crossDraft.data[0].outbox_id, null);
  // Mesmo número de cliente em B cria conversa separada; B está em observação => humano.
  await deliver(customerMsg('Oi B', { pn: PN_B }));
  const convB = await conversationOf(CUSTOMER, WS_B);
  assert.notEqual(convB.id, conv.id);
  assert.equal(convB.owner, 'human');
  // FK composta impede mensagem apontando para conversa de outro workspace.
  await assert.rejects(() => sql("insert into ai_messages (workspace_id, conversation_id, direction, sender_type) values ($1, $2, 'inbound', 'customer')", [WS_B, conv.id]));
  // Um phone_number_id não pode pertencer a dois workspaces.
  await assert.rejects(() => sql("insert into ai_channels (workspace_id, phone_number_id) values ($1, $2)", [WS_B, PN_A]));
});

test('janela de 24h: fora dela o envio falha sem chamar a Meta', async () => {
  const chat = '15550001013';
  await deliver(customerMsg('Oi', { chat }));
  const conv = await conversationOf(chat);
  await sql("update ai_conversations set last_inbound_at = now() - interval '25 hours' where id = $1", [conv.id]);
  await service.rpc('ai_enqueue_human_message', { p_workspace_id: WS_A, p_conversation_id: conv.id, p_actor_user_id: null, p_idempotency_key: id('h'), p_content: 'atrasada' });
  const { meta, deps: d } = deps();
  const results = await dispatchOutbox({ supabase: service, workspaceId: WS_A, deps: d });
  assert.ok(results.some((r) => r.error === 'outside_24h_window'));
  assert.equal(meta.sent.filter((s) => s.to === chat).length, 0);
});

test('reconciliação: lease vencido vira unknown (sem reenvio) e status da Meta confirma', async () => {
  const conv = await conversationOf();
  const [row] = await sql("insert into ai_message_outbox (workspace_id, conversation_id, owner_version, idempotency_key, content, status, sender_type, lease_expires_at, provider_message_id) values ($1, $2, $3, $4, 'talvez', 'dispatching', 'human', now() - interval '1 minute', 'wamid.maybe') returning id", [WS_A, conv.id, conv.owner_version, id('k')]);
  const { meta, deps: d } = deps();
  const cycle = await runInboxCycle({ supabase: service, deps: d });
  assert.ok(cycle.reaped >= 1);
  const [after] = await sql('select status from ai_message_outbox where id = $1', [row.id]);
  assert.equal(after.status, 'unknown');
  assert.ok(!meta.sent.some((s) => s.text === 'talvez'), 'não reenviado automaticamente');
  await deliver(webhook('messages', { statuses: [{ id: 'wamid.maybe', status: 'delivered', recipient_id: CUSTOMER }] }));
  const [reconciled] = await sql('select status from ai_message_outbox where id = $1', [row.id]);
  assert.equal(reconciled.status, 'sent');
});

test('histórico da Coexistence: importa sem acionar IA nem contar como não lida', async () => {
  const chat = '15550002001';
  const res = await deliver(webhook('history', { history: [{ metadata: { phase: 0, progress: 100 }, threads: [{ id: chat, messages: [
    { from: chat, id: id('wamid.h'), timestamp: '1700000000', type: 'text', text: { body: 'mensagem antiga' } },
    { from: '15550000000', id: id('wamid.h'), timestamp: '1700000100', type: 'text', text: { body: 'resposta antiga' } },
  ] }] }] }));
  assert.equal(res.pending.length, 0);
  const conv = await conversationOf(chat);
  assert.deepEqual([conv.owner, conv.unread_count, conv.ai_pending_since], ['human', 0, null]);
  const [{ history_sync_status: syncStatus }] = await sql('select history_sync_status from ai_channels where phone_number_id = $1', [PN_A]);
  assert.equal(syncStatus, 'completed');
});

test('LGPD: exclusão do titular e retenção', async () => {
  const chat = '15550003001';
  await deliver(customerMsg('apagar meus dados', { chat }));
  const { data: erased } = await service.rpc('ai_erase_contact', { p_workspace_id: WS_A, p_provider_chat_id: chat });
  assert.equal(erased, 1);
  const [{ n }] = await sql('select count(*)::int n from ai_messages m join ai_conversations c on c.id = m.conversation_id where c.provider_chat_id = $1', [chat]);
  assert.equal(n, 0);
  await sql("update ai_messages set created_at = now() - interval '400 days' where workspace_id = $1 and content = 'Olá! Vocês fazem casamento?'", [WS_A]);
  const { data } = await service.rpc('ai_purge_expired_data');
  assert.ok(Number(data[0].messages_deleted) >= 1);
});

test('reenvio da Meta após falha no meio do lote reprocessa sem duplicar', async () => {
  const chat = '15550004001';
  const payload = customerMsg('Primeira tentativa', { chat });
  const rawBody = JSON.stringify(payload);
  // Simula lote que falhou: registro de dedupe existe com status 'failed' e nada foi gravado.
  const { sha256Hex } = await import('../../lib/ai/inbox/meta-webhook.mjs');
  await sql("insert into ai_webhook_events (provider, dedupe_key, kind, status) values ('meta_cloud', $1, 'batch', 'failed')", [await sha256Hex(rawBody)]);
  const retry = await ingestWebhook({ supabase: service, rawBody, payload });
  assert.equal(retry.duplicate, false);
  assert.equal(retry.stats.messages, 1);
  const again = await ingestWebhook({ supabase: service, rawBody, payload });
  assert.equal(again.duplicate, true);
});

