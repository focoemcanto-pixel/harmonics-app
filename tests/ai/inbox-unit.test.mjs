// Testes unitários do Inbox híbrido (dados 100% sintéticos).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyMetaSignature, verifyMetaChallenge, parseMetaWebhook, hmacSha256Hex, extractMessageContent,
} from '../../lib/ai/inbox/meta-webhook.mjs';
import { encryptSecret, decryptSecret } from '../../lib/ai/inbox/secret-box.mjs';
import { sendTextMessage, isWithinCustomerServiceWindow, fetchPhoneNumberStatus } from '../../lib/ai/inbox/meta-client.mjs';
import { resolveAiGate, detectHandoffTrigger, sanitizeReply } from '../../lib/ai/agent/policy.mjs';
import { buildSystemPrompt, buildConversationInput } from '../../lib/ai/agent/prompt.mjs';
import { executeTool, samePhoneBR, TOOL_DEFINITIONS } from '../../lib/ai/agent/tools.mjs';
import { generateReply, estimateCostUsd } from '../../lib/ai/agent/llm.mjs';
import { parseSettingsInput, parseChannelInput } from '../../lib/ai/inbox/settings-input.mjs';
import { applyInboxFilter, sanitizeSearch } from '../../lib/ai/inbox/inbox-queries.mjs';

const KEY = Buffer.alloc(32, 7).toString('base64');
const ON = { AI_INBOX_AI_ENABLED: 'true' };

function metaPayload(field, value) {
  return { object: 'whatsapp_business_account', entry: [{ id: 'waba-test', changes: [{ field, value: { metadata: { phone_number_id: 'pn-test', display_phone_number: '15550000000' }, ...value } }] }] };
}

// --- webhook --------------------------------------------------------------
test('assinatura do webhook: válida, inválida, ausente e sem segredo (falha fechada)', async () => {
  const body = '{"x":1}';
  const sig = `sha256=${await hmacSha256Hex('app-secret-test', body)}`;
  assert.equal((await verifyMetaSignature({ rawBody: body, signatureHeader: sig, appSecret: 'app-secret-test' })).ok, true);
  assert.equal((await verifyMetaSignature({ rawBody: body + ' ', signatureHeader: sig, appSecret: 'app-secret-test' })).status, 401);
  assert.equal((await verifyMetaSignature({ rawBody: body, signatureHeader: null, appSecret: 'app-secret-test' })).status, 401);
  assert.equal((await verifyMetaSignature({ rawBody: body, signatureHeader: sig, appSecret: '' })).status, 503);
});

test('desafio GET exige modo subscribe e token exato', () => {
  const ok = verifyMetaChallenge(new URLSearchParams('hub.mode=subscribe&hub.verify_token=tok-1&hub.challenge=42'), 'tok-1');
  assert.deepEqual(ok, { ok: true, challenge: '42' });
  assert.equal(verifyMetaChallenge(new URLSearchParams('hub.mode=subscribe&hub.verify_token=x&hub.challenge=42'), 'tok-1').ok, false);
  assert.equal(verifyMetaChallenge(new URLSearchParams('hub.mode=subscribe&hub.verify_token=tok-1&hub.challenge=42'), '').status, 503);
});

test('parse: mensagem de cliente, status, eco do app Business, histórico e contato', () => {
  const inbound = parseMetaWebhook(metaPayload('messages', {
    contacts: [{ wa_id: '15551110001', profile: { name: 'Cliente Teste' } }],
    messages: [
      { from: '15551110001', id: 'wamid.in1', timestamp: '1700000000', type: 'text', text: { body: 'Olá' } },
      { from: '15551110001', id: 'wamid.in2', timestamp: '1700000001', type: 'audio', audio: { id: 'media-1', mime_type: 'audio/ogg' } },
      { from: '15551110001', id: 'wamid.react', type: 'reaction', reaction: { emoji: '👍' } },
    ],
    statuses: [{ id: 'wamid.out1', status: 'delivered', recipient_id: '15551110001' }],
  }));
  assert.equal(inbound.filter((e) => e.kind === 'message').length, 2, 'reação é ignorada');
  assert.equal(inbound[0].contactName, 'Cliente Teste');
  assert.equal(inbound[1].mediaId, 'media-1');
  assert.equal(inbound.find((e) => e.kind === 'status').status, 'delivered');

  const [echo] = parseMetaWebhook(metaPayload('smb_message_echoes', {
    message_echoes: [{ from: '15550000000', to: '15551110001', id: 'wamid.echo1', timestamp: '1700000002', type: 'text', text: { body: 'Oi, aqui é da equipe' } }],
  }));
  assert.equal(echo.origin, 'business_app');
  assert.equal(echo.direction, 'outbound');
  assert.equal(echo.chatId, '15551110001');

  const history = parseMetaWebhook(metaPayload('history', {
    history: [{ metadata: { phase: 0, progress: 100 }, threads: [{ id: '15551110002', messages: [
      { from: '15551110002', id: 'wamid.h1', timestamp: '1690000000', type: 'text', text: { body: 'antiga' } },
      { from: '15550000000', id: 'wamid.h2', timestamp: '1690000001', type: 'text', text: { body: 'resposta antiga' } },
    ] }] }],
  }));
  assert.equal(history[0].kind, 'history_progress');
  assert.deepEqual(history.slice(1).map((e) => [e.origin, e.direction]), [['history', 'inbound'], ['history', 'outbound']]);

  const [contact] = parseMetaWebhook(metaPayload('smb_app_state_sync', { state_sync: [{ type: 'contact', action: 'add', contact: { full_name: 'Contato Teste', phone_number: '+1 555 111 0003' } }] }));
  assert.deepEqual([contact.kind, contact.chatId], ['contact', '15551110003']);

  assert.deepEqual(parseMetaWebhook({ object: 'page' }), []);
});

test('conteúdo interativo e localização viram texto', () => {
  assert.equal(extractMessageContent({ type: 'interactive', interactive: { button_reply: { title: 'Sim' } } }).content, 'Sim');
  assert.match(extractMessageContent({ type: 'location', location: { name: 'Salão Exemplo' } }).content, /Salão Exemplo/);
});

// --- credenciais -------------------------------------------------------------
test('token do canal: AES-GCM ida e volta, sem chave falha fechado, chave errada não decifra', async () => {
  const boxed = await encryptSecret('token-sintetico-123456789', KEY);
  assert.match(boxed, /^v1:/);
  assert.ok(!boxed.includes('token-sintetico'));
  assert.equal(await decryptSecret(boxed, KEY), 'token-sintetico-123456789');
  await assert.rejects(() => encryptSecret('x', ''));
  await assert.rejects(() => decryptSecret(boxed, Buffer.alloc(32, 9).toString('base64')));
});

// --- Cloud API ---------------------------------------------------------------
test('envio: sucesso, rejeição definitiva, 5xx e timeout viram unknown (não reenviar)', async () => {
  const reply = (status, body) => async () => ({ ok: status < 300, status, json: async () => body });
  assert.deepEqual(await sendTextMessage({ phoneNumberId: 'p', token: 't', to: '1', text: 'a', fetchImpl: reply(200, { messages: [{ id: 'wamid.ok' }] }) }), { status: 'sent', providerMessageId: 'wamid.ok' });
  assert.equal((await sendTextMessage({ phoneNumberId: 'p', token: 't', to: '1', text: 'a', fetchImpl: reply(400, { error: { code: 131047 } }) })).error, '131047');
  assert.equal((await sendTextMessage({ phoneNumberId: 'p', token: 't', to: '1', text: 'a', fetchImpl: reply(503, {}) })).status, 'unknown');
  const abort = async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; };
  assert.deepEqual(await sendTextMessage({ phoneNumberId: 'p', token: 't', to: '1', text: 'a', fetchImpl: abort }), { status: 'unknown', error: 'timeout' });
});

test('diagnóstico de Coexistence lê is_on_biz_app', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ is_on_biz_app: true, platform_type: 'CLOUD_API', verified_name: 'Empresa Teste' }) });
  const status = await fetchPhoneNumberStatus({ phoneNumberId: 'p', token: 't', fetchImpl });
  assert.equal(status.coexistence, true);
});

test('janela de 24h', () => {
  const now = Date.parse('2030-01-02T12:00:00Z');
  assert.equal(isWithinCustomerServiceWindow('2030-01-02T00:00:00Z', now), true);
  assert.equal(isWithinCustomerServiceWindow('2030-01-01T11:59:00Z', now), false);
  assert.equal(isWithinCustomerServiceWindow(null, now), false);
});

// --- política ---------------------------------------------------------------
const settings = { ai_enabled: true, mode: 'auto', daily_ai_reply_limit: 10, daily_cost_limit_usd: 1, monthly_cost_limit_usd: 5, max_ai_turns_per_conversation: 5 };
const channel = { status: 'active' };
const conversation = { owner: 'ai', ai_enabled: true, state: 'open', needs_human: false, ai_turns: 0 };

test('gate da IA: tudo fail-closed e kill switch global vence', () => {
  assert.equal(resolveAiGate({ env: ON, settings, channel, conversation }).allowed, true);
  assert.equal(resolveAiGate({ env: { ...ON, AI_INBOX_KILL_SWITCH: 'true' }, settings, channel, conversation }).reason, 'global_kill_switch');
  assert.equal(resolveAiGate({ env: {}, settings, channel, conversation }).reason, 'global_ai_disabled');
  assert.equal(resolveAiGate({ env: ON, settings: { ...settings, ai_enabled: false }, channel, conversation }).reason, 'workspace_ai_disabled');
  assert.equal(resolveAiGate({ env: ON, settings: { ...settings, mode: 'observe' }, channel, conversation }).reason, 'observe_mode');
  assert.equal(resolveAiGate({ env: ON, settings, channel: { status: 'paused' }, conversation }).reason, 'channel_inactive');
  assert.equal(resolveAiGate({ env: ON, settings, channel, conversation: { ...conversation, owner: 'human' } }).reason, 'human_owner');
  assert.equal(resolveAiGate({ env: ON, settings, channel, conversation: { ...conversation, needs_human: true } }).reason, 'awaiting_human');
  assert.equal(resolveAiGate({ env: ON, settings, channel, conversation: { ...conversation, ai_enabled: false } }).reason, 'conversation_ai_disabled');
  assert.equal(resolveAiGate({ env: ON, settings: { ...settings, mode: 'draft' }, channel, conversation }).asDraft, true);
});

test('controle de custos e turnos pede humano', () => {
  for (const [usage, reason] of [
    [{ day_replies: 10 }, 'daily_reply_limit'],
    [{ day_cost: 1 }, 'daily_cost_limit'],
    [{ month_cost: 5 }, 'monthly_cost_limit'],
  ]) {
    const gate = resolveAiGate({ env: ON, settings, channel, conversation, usage });
    assert.deepEqual([gate.allowed, gate.reason, gate.handoff], [false, reason, true]);
  }
  assert.equal(resolveAiGate({ env: ON, settings, channel, conversation: { ...conversation, ai_turns: 5 } }).reason, 'turn_limit');
});

test('gatilhos de transferência humana', () => {
  assert.equal(detectHandoffTrigger('Quero falar com um atendente, por favor')?.reason, 'customer_requested_human');
  assert.equal(detectHandoffTrigger('Você é um robô?')?.reason, 'customer_requested_human');
  assert.equal(detectHandoffTrigger('Consegue um desconto?'), null, 'desconto segue a ordem de negociação (Manual §10)');
  assert.equal(detectHandoffTrigger('Preciso alterar o contrato para outra data do evento')?.reason, 'contract_change');
  assert.equal(detectHandoffTrigger('Quero cancelar')?.reason, 'cancellation_or_refund');
  assert.equal(detectHandoffTrigger('Oi! Queria saber valores para casamento'), null);
});

test('saída do modelo: corta longa, bloqueia placeholder', () => {
  assert.equal(sanitizeReply('O valor é [valor] para você'), null);
  assert.equal(sanitizeReply('  **Oi!** tudo bem?  '), '*Oi!* tudo bem?');
  assert.ok(sanitizeReply('Frase. '.repeat(300)).length <= 700);
});

// --- prompt / memória -------------------------------------------------------
test('prompt: identificação transparente na primeira resposta e memória do lead', () => {
  const first = buildSystemPrompt({ settings: { assistant_name: 'Lia' }, companyName: 'Empresa Exemplo', conversation: { lead_data: { tipo_evento: 'casamento' } }, isFirstAiReply: true });
  assert.match(first, /assistente virtual da Empresa Exemplo/);
  assert.match(first, /NUNCA invente/);
  assert.match(first, /casamento/);
  const later = buildSystemPrompt({ settings: {}, isFirstAiReply: false });
  assert.match(later, /não repita a apresentação/);
});

test('histórico vira entrada cronológica com transcrição de áudio', () => {
  const input = buildConversationInput([
    { direction: 'outbound', sender_type: 'human', content: 'Oi!', created_at: '2030-01-01T10:01:00Z' },
    { direction: 'inbound', content: '', transcript: 'quero orçamento', message_type: 'audio', created_at: '2030-01-01T10:02:00Z' },
    { direction: 'inbound', content: 'Olá', created_at: '2030-01-01T10:00:00Z' },
  ]);
  assert.deepEqual(input.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.match(input[1].content, /^\[equipe\]/);
  assert.match(input[2].content, /quero orçamento/);
});

// --- ferramentas ------------------------------------------------------------
function fakeSupabase(tables = {}) {
  const calls = [];
  const from = (table) => {
    const filters = [];
    const q = {
      select() { return q; }, eq(c, v) { filters.push([c, v]); return q; }, ilike() { return q; }, in() { return q; },
      order() { return q; }, limit() { return q; },
      insert(row) { calls.push(['insert', table, row]); return Promise.resolve({ error: null }); },
      update(row) { calls.push(['update', table, row]); return q; },
      async maybeSingle() { return { data: (tables[table] || []).find((r) => filters.every(([c, v]) => r[c] === v)) || null, error: null }; },
      then(resolve) { resolve({ data: (tables[table] || []).filter((r) => filters.every(([c, v]) => r[c] === v)), error: null }); },
    };
    return q;
  };
  return { from, calls };
}

test('preços: só do workspace; sem cadastro não inventa', async () => {
  const supabase = fakeSupabase({ pricing_settings: [{ workspace_id: 'ws-a', price_trio: 1234, reception_trio_2h: 321, sound_price: 111 }] });
  const ok = await executeTool('consultar_precos', { formacao: 'trio', recepcao_horas: 2, com_som: true }, { supabase, workspaceId: 'ws-a' });
  assert.deepEqual([ok.valor_cerimonia, ok.valor_recepcao, ok.valor_som], [1234, 321, 111]);
  const missing = await executeTool('consultar_precos', { formacao: 'trio' }, { supabase, workspaceId: 'ws-b' });
  assert.equal(missing.ok, false);
  assert.equal(missing.erro, 'precos_nao_cadastrados');
  const unknownFormation = await executeTool('consultar_precos', { formacao: 'orquestra' }, { supabase, workspaceId: 'ws-a' });
  assert.equal(unknownFormation.erro, 'formacao_desconhecida');
});

test('disponibilidade: não expõe clientes, ignora cancelados, rejeita data inválida', async () => {
  const supabase = fakeSupabase({ events: [
    { workspace_id: 'ws-a', event_date: '2099-05-10', status: 'confirmado', client_name: 'Nome Privado' },
    { workspace_id: 'ws-a', event_date: '2099-05-11', status: 'cancelado' },
  ] });
  const busy = await executeTool('consultar_disponibilidade', { data: '2099-05-10' }, { supabase, workspaceId: 'ws-a' });
  assert.equal(busy.eventos_na_data, 1);
  assert.ok(!JSON.stringify(busy).includes('Nome Privado'));
  assert.equal((await executeTool('consultar_disponibilidade', { data: '2099-05-11' }, { supabase, workspaceId: 'ws-a' })).eventos_na_data, 0);
  assert.equal((await executeTool('consultar_disponibilidade', { data: '2099-02-30' }, { supabase, workspaceId: 'ws-a' })).erro, 'data_invalida');
  assert.equal((await executeTool('nao_existe', {}, {})).erro, 'ferramenta_desconhecida');
});

test('aprovação e transferência sinalizam humano', async () => {
  const supabase = fakeSupabase();
  const effects = {};
  const conv = { id: 'c1', lead_data: {} };
  await executeTool('solicitar_aprovacao', { tipo: 'discount', resumo: 'Cliente pediu condição especial' }, { supabase, workspaceId: 'ws-a', conversation: conv, effects });
  assert.equal(effects.needsHuman.reason, 'discount_request');
  assert.equal(supabase.calls[0][1], 'ai_approvals');
  const e2 = {};
  await executeTool('transferir_para_humano', { motivo: 'dúvida técnica' }, { effects: e2 });
  assert.equal(e2.needsHuman.reason, 'ai_requested');
});

test('telefone BR tolera 9º dígito e exige DDD igual', () => {
  assert.equal(samePhoneBR('5511912345678', '11 1234-5678'), true);
  assert.equal(samePhoneBR('551112345678', '(11) 91234-5678'), true);
  assert.equal(samePhoneBR('5511912345678', '5521912345678'), false);
  assert.equal(samePhoneBR('', '123'), false);
});

test('definições de ferramenta são estritas', () => {
  for (const tool of TOOL_DEFINITIONS) assert.equal(tool.parameters.additionalProperties, false);
});

// --- LLM ----------------------------------------------------------------------
test('laço de function calling executa ferramenta e soma tokens/custo', async () => {
  const responses = [
    { output: [{ type: 'function_call', call_id: 'k1', name: 'consultar_precos', arguments: '{"formacao":"Duo"}' }], usage: { input_tokens: 100, output_tokens: 10 } },
    { output_text: 'O duo parte de R$ 1.000. Qual a data?', usage: { input_tokens: 150, output_tokens: 20 } },
  ];
  const sent = [];
  const fetchImpl = async (_url, init) => { sent.push(JSON.parse(init.body)); return { ok: true, json: async () => responses.shift() }; };
  const executed = [];
  const result = await generateReply({
    system: 's', input: [{ role: 'user', content: 'oi' }], tools: TOOL_DEFINITIONS,
    executeTool: async (name, args) => { executed.push([name, args]); return { ok: true }; },
    env: { OPENAI_API_KEY: 'sk-test' }, fetchImpl,
  });
  assert.deepEqual(executed, [['consultar_precos', { formacao: 'Duo' }]]);
  assert.equal(result.text, 'O duo parte de R$ 1.000. Qual a data?');
  assert.equal(result.inputTokens, 250);
  assert.equal(sent[1].input.at(-1).type, 'function_call_output');
  assert.equal(sent[0].store, false);
  assert.ok(result.costUsd > 0);
  await assert.rejects(() => generateReply({ system: '', input: [], tools: [], executeTool: async () => ({}), env: {} }), /llm_not_configured/);
});

test('custo estimado com override por env', () => {
  assert.equal(estimateCostUsd('gpt-4.1-mini', 1_000_000, 0, {}), 0.4);
  assert.equal(estimateCostUsd('gpt-4.1-mini', 1_000_000, 0, { AI_PRICE_GPT_4_1_MINI: '1,2' }), 1);
});

// --- entradas de configuração e filtros ------------------------------------
test('configurações: limites saneados e token só com tamanho mínimo', () => {
  const s = parseSettingsInput({ ai_enabled: true, mode: 'auto', daily_cost_limit_usd: '999', retention_days: 5, workspace_id: 'outro' });
  assert.deepEqual(s, { ai_enabled: true, mode: 'auto', daily_cost_limit_usd: 100, retention_days: 30 });
  assert.equal(parseSettingsInput({ mode: 'turbo' }).mode, undefined);
  const c = parseChannelInput({ phone_number_id: ' 123-456 ', status: 'active', access_token: 'curto', workspace_id: 'x' });
  assert.deepEqual(c, { fields: { phone_number_id: '123456', status: 'active' }, accessToken: null });
});

test('filtros e busca do Inbox', () => {
  const calls = [];
  const q = new Proxy({}, { get: (_t, prop) => (...args) => { calls.push([prop, ...args]); return q; } });
  applyInboxFilter(q, 'needs_human');
  assert.deepEqual(calls, [['eq', 'needs_human', true], ['eq', 'state', 'open']]);
  assert.equal(sanitizeSearch('a%b,(c)*'), 'a b  c');
});
