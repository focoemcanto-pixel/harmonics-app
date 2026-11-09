// Inteligência comercial em Postgres LOCAL descartável (schema real + migrations AI v1–v3).
// Código real do app com Meta e LLM FALSOS. Prova: fechamento até pré-contrato com
// confirmação expressa e idempotência, invalidação por correção, revalidação, contrato
// assinado preservado, agenda do vocalista principal, conhecimento versionado com rollback,
// aprendizado supervisionado, follow-ups (agendamento, cancelamentos, template fora da
// janela), opt-out e território bloqueado. Dados 100% sintéticos.
//
// Rodar: ./supabase/local/run-ai-inbox.sh (inclui este arquivo).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPgSupabase } from './pg-supabase.mjs';
import { encryptSecret } from '../../lib/ai/inbox/secret-box.mjs';
import { ingestWebhook, processConversationReply, dispatchOutbox, runInboxCycle } from '../../lib/ai/inbox/service.mjs';
import { clearKnowledgeCache } from '../../lib/ai/commercial/engine.mjs';
import { decideSuggestion } from '../../lib/ai/commercial/learning.mjs';
import { approveAndQueueLink } from '../../lib/ai/commercial/supervision.mjs';
import { buildQueues } from '../../lib/ai/commercial/queues.mjs';

const DB_URL = process.env.LOCAL_DB_URL || 'postgresql://postgres@localhost/harmonics_local?host=/tmp&port=54329';
const parsed = new URL(DB_URL);
if (decodeURIComponent(parsed.pathname.slice(1)) !== 'harmonics_local' || !['/tmp', 'localhost', '127.0.0.1'].includes(parsed.searchParams.get('host') || parsed.hostname)) {
  throw new Error('ai-commercial.local: recusado — use somente o banco descartável harmonics_local local.');
}
const pg = (await import(process.env.PG_MODULE || 'pg')).default;
const pool = new pg.Pool({ connectionString: DB_URL, max: 10 });
const service = createPgSupabase({ pool, role: 'service_role' });

const KEY = Buffer.alloc(32, 5).toString('base64');
const ENV = { AI_INBOX_AI_ENABLED: 'true', OPENAI_API_KEY: 'sk-test', AI_CHANNEL_ENCRYPTION_KEY: KEY, NEXT_PUBLIC_APP_URL: 'https://app.example.test' };
const WS = '00000000-0000-4000-8000-0000000000c1';
const PN = '900000000101';
const VOCAL_CONTACT = '00000000-0000-4000-8000-0000000000d1';
const SUB_CONTACT = '00000000-0000-4000-8000-0000000000d2';
const DATE = '2098-06-10';
const APPROVER = '00000000-0000-4000-8000-0000000000e9';
let seq = 0;
const nid = (p) => `${p}.${Date.now()}.${(seq += 1)}`;

const sql = async (text, params) => (await pool.query(text, params)).rows;
function webhook(field, value) {
  return { object: 'whatsapp_business_account', entry: [{ id: 'waba-synthetic', changes: [{ field, value: { metadata: { phone_number_id: PN, display_phone_number: '15550000000' }, ...value } }] }] };
}
async function say(chat, text) {
  const payload = webhook('messages', { messages: [{ from: chat, id: nid('wamid.in'), timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: text } }] });
  return ingestWebhook({ supabase: service, rawBody: JSON.stringify(payload), payload });
}
async function conv(chat) { return (await sql('select * from ai_conversations where workspace_id = $1 and provider_chat_id = $2', [WS, chat]))[0]; }
async function ready(chat) { await sql("update ai_conversations set ai_pending_since = now() - interval '10 seconds' where workspace_id = $1 and provider_chat_id = $2", [WS, chat]); }

function harness(llm) {
  const sent = [];
  const seen = [];
  return {
    sent, seen,
    deps: {
      env: ENV,
      routeFn: null,
      notifyAdmin: async () => ({ ok: true }),
      sendTextMessage: async ({ to, text }) => { const id = nid('wamid.out'); sent.push({ to, text, id, kind: 'text' }); return { status: 'sent', providerMessageId: id }; },
      sendTemplateMessage: async ({ to, name }) => { const id = nid('wamid.tpl'); sent.push({ to, name, id, kind: 'template' }); return { status: 'sent', providerMessageId: id }; },
      generateReply: async (args) => { seen.push(args); return llm(args); },
    },
  };
}
const reply = (text, toolCalls = []) => ({ text, model: 'fake', inputTokens: 10, outputTokens: 5, costUsd: 0.0001, toolCalls });
const closeTool = (extra = {}) => async ({ executeTool }) => {
  await executeTool('registrar_dados_evento', { tipo_evento: 'Casamento' });
  await executeTool('preparar_fechamento', { data: DATE, horario: '16:00', formacao: 'Trio', instrumentos: 'violino, violoncelo e voz', com_som: true, recepcao_formacao: 'Duo', recepcao_horas: 2, local: 'Cidade Base', ...extra });
  return reply('texto do modelo que não deve sair', ['preparar_fechamento']);
};
async function turn(chat, text, llm) {
  await say(chat, text);
  await ready(chat);
  const h = harness(llm);
  const c = await conv(chat);
  const result = await processConversationReply({ supabase: service, workspaceId: WS, conversationId: c.id, deps: h.deps });
  await dispatchOutbox({ supabase: service, workspaceId: WS, deps: h.deps });
  return { ...h, result, conversation: await conv(chat) };
}

test.before(async () => {
  await sql("delete from workspaces where id = $1", [WS]);
  await sql("insert into workspaces (id, key, name, slug) values ($1, 'ws-c-test', 'Workspace Comercial Teste', 'ws-c-test')", [WS]);
  const [tpl] = await sql("insert into contract_templates (workspace_id, name, slug, is_active, content) values ($1, 'Modelo Casamento Teste', 'casamento-c-test', true, '<p>Cláusula sintética.</p>') returning id", [WS]);
  await sql("insert into event_types (workspace_id, name, slug, is_active, default_contract_template_id) values ($1, 'Casamento', 'casamento-c-test', true, $2)", [WS, tpl.id]);
  await sql("insert into ai_channels (workspace_id, phone_number_id, access_token_encrypted, status) values ($1, $2, $3, 'active')", [WS, PN, await encryptSecret('token-sintetico-para-testes-0002', KEY)]);
  await sql(`insert into ai_workspace_settings (workspace_id, ai_enabled, mode, autonomous_closing_enabled, followup_enabled, followup_days, followup_templates)
             values ($1, true, 'auto', true, true, '{2,5,10}', '{retorno_um,retorno_dois,retorno_tres}')`, [WS]);
  await sql(`insert into quote_price_rules (workspace_id, category, item_key, label, amount, valid_from) values
    ($1,'ceremony','trio','Trio',3000,'2020-01-01'), ($1,'reception','duo_2h','Duo 2h',1200,'2020-01-01'), ($1,'sound','church_reception','Som',700,'2020-01-01')`, [WS]);
  await sql(`insert into ai_service_areas (workspace_id, name, status) values ($1,'Cidade Base','served')`, [WS]);
  await sql(`insert into ai_service_areas (workspace_id, name, status) values ($1,'Cidade Bloqueada','blocked')`, [WS]);
  await sql("insert into contacts (id, workspace_id, name, contact_type) values ($1,$3,'Vocalista Principal Teste','musician'), ($2,$3,'Vocalista Substituto Teste','musician')", [VOCAL_CONTACT, SUB_CONTACT, WS]);
  await sql(`insert into ai_musician_profiles (workspace_id, contact_id, display_name, roles, is_primary_vocal, video_urls) values
    ($1,$2,'Vocalista Principal Teste','{vocal}',true,'{}'), ($1,$3,'Vocalista Substituto Teste','{vocal}',false,'{https://video.example.test/sub}')`, [WS, VOCAL_CONTACT, SUB_CONTACT]);
  clearKnowledgeCache();
});
test.after(async () => { await pool.end(); });

test('fechamento completo: resumo determinístico → CONFIRMO → pré-contrato + link, sem dados pessoais e sem duplicar', async () => {
  const chat = '15550005001';
  const first = await turn(chat, 'Quero fechar com vocês!', closeTool());
  const summary = first.sent.find((s) => s.to === chat).text;
  assert.match(summary, /10\/06\/2098 às 16:00/);
  assert.match(summary, /R\$ 4\.900,00/);
  assert.match(summary, /Vocalista Principal Teste/);
  assert.ok(!summary.includes('texto do modelo'), 'resumo é sempre o determinístico');
  assert.equal(first.conversation.sales_stage, 'closing');
  assert.equal((await sql("select status from ai_closings where conversation_id = $1", [first.conversation.id]))[0].status, 'awaiting_confirmation');

  const confirm = await turn(chat, 'CONFIRMO', async () => { throw new Error('LLM não deve ser chamado na confirmação'); });
  assert.equal(confirm.result.reason, 'awaiting_approval', 'modo supervisionado: aguarda aprovação do responsável');
  const prep = confirm.sent.find((s) => s.to === chat).text;
  assert.ok(!/contrato\//.test(prep), 'nenhum link sai antes da aprovação');
  const [cl] = await sql('select * from ai_closings where conversation_id = $1 and status = $2', [confirm.conversation.id, 'awaiting_approval']);
  assert.ok(cl.approval_hash && cl.conventional === true, 'caso convencional preparado com hash da versão');
  const [pc] = await sql('select p.*, et.name as et_name from precontracts p left join event_types et on et.id = p.event_type_id where p.id = $1', [confirm.conversation.precontract_id]);
  assert.deepEqual(
    [pc.event_date.toISOString().slice(0, 10), pc.formation, pc.instruments, pc.has_sound, pc.reception_hours, pc.reception_formation, Number(pc.base_amount), Number(pc.add_reception), Number(pc.add_sound), Number(pc.agreed_amount), pc.status, pc.et_name, Boolean(pc.contract_template_id)],
    [DATE, 'Trio', 'violino, violoncelo, voz', true, 2, 'Duo', 3000, 1200, 700, 4900, 'draft', 'Casamento', true],
  );
  assert.deepEqual([pc.client_name, pc.client_email, pc.client_phone, pc.location_address], [null, null, null, null], 'dados pessoais ficam para o cliente');
  const queues = await buildQueues({ supabase: service, workspaceId: WS });
  const qcard = queues.contracts.find((c) => c.closing_id === cl.id);
  assert.equal(qcard.whatsapp_url, `https://wa.me/${chat}`);

  // Aprovação do responsável (versão exata) => link sai uma única vez.
  const h = harness(async () => reply('x'));
  const ok1 = await approveAndQueueLink({ supabase: service, workspaceId: WS, closingId: cl.id, approvalHash: cl.approval_hash, actor: APPROVER, mode: 'manual' });
  assert.equal(ok1.status, 'approved');
  await dispatchOutbox({ supabase: service, workspaceId: WS, deps: h.deps });
  assert.match(h.sent.find((s) => s.to === chat).text, /https:\/\/app\.example\.test\/contrato\/[a-z0-9]+/);
  const ok2 = await approveAndQueueLink({ supabase: service, workspaceId: WS, closingId: cl.id, approvalHash: cl.approval_hash, actor: APPROVER, mode: 'manual' });
  assert.equal(ok2.status, 'already_sent');
  await dispatchOutbox({ supabase: service, workspaceId: WS, deps: h.deps });
  assert.equal(h.sent.filter((s) => s.to === chat).length, 1, 'retry não reenvia o link');
  const [after] = await sql('select status, sent_at from ai_closings where id = $1', [cl.id]);
  assert.equal(after.status, 'link_sent');
  assert.equal((await sql('select status from precontracts where id = $1', [pc.id]))[0].status, 'link_generated');
  assert.equal((await conv(chat)).sales_stage, 'contract_sent');
  const [quote] = await sql('select status, precontract_id from quotes where id = $1', [confirm.conversation.quote_id]);
  assert.deepEqual([quote.status, quote.precontract_id], ['approved', pc.id]);

  // Repetir a confirmação não cria outro pré-contrato.
  await turn(chat, 'confirmo', async () => reply('Seu link já foi enviado acima 😊'));
  const [{ n }] = await sql("select count(*)::int n from precontracts where workspace_id = $1", [WS]);
  assert.equal(n, 1);
});

test('correção após o resumo invalida a confirmação anterior', async () => {
  const chat = '15550005002';
  await turn(chat, 'Vamos fechar', closeTool());
  let called = false;
  const t = await turn(chat, 'na verdade o receptivo é de 1 hora', async () => { called = true; return reply('Claro! Vou ajustar.'); });
  assert.equal(called, true, 'correção volta para o LLM');
  const rows = await sql('select status from ai_closings where conversation_id = $1', [t.conversation.id]);
  assert.deepEqual(rows.map((r) => r.status), ['invalidated']);
  assert.equal(t.conversation.precontract_id, null);
});

test('revalidação: preço mudou entre resumo e confirmação => humano, sem pré-contrato', async () => {
  const chat = '15550005003';
  await turn(chat, 'quero contratar', closeTool());
  await sql("update quote_price_rules set amount = 3500 where workspace_id = $1 and category = 'ceremony'", [WS]);
  const t = await turn(chat, 'Confirmo', async () => reply('x'));
  await sql("update quote_price_rules set amount = 3000 where workspace_id = $1 and category = 'ceremony'", [WS]);
  assert.equal(t.result.reason, 'price_changed');
  assert.equal(t.conversation.needs_human, true);
  assert.equal(t.conversation.precontract_id, null);
});

test('aprovação vale para a versão exata: alteração material exige nova aprovação', async () => {
  const chat = '15550005004';
  await turn(chat, 'bora fechar', closeTool());
  const t = await turn(chat, 'sim', async () => reply('x'));
  const [cl] = await sql("select * from ai_closings where conversation_id = $1 and status = 'awaiting_approval'", [t.conversation.id]);
  await sql('update precontracts set agreed_amount = 4500 where id = $1', [cl.precontract_id]);
  const r1 = await approveAndQueueLink({ supabase: service, workspaceId: WS, closingId: cl.id, approvalHash: cl.approval_hash, actor: APPROVER });
  assert.equal(r1.status, 'version_changed');
  assert.notEqual(r1.approvalHash, cl.approval_hash);
  const r2 = await approveAndQueueLink({ supabase: service, workspaceId: WS, closingId: cl.id, approvalHash: r1.approvalHash, actor: APPROVER });
  assert.equal(r2.status, 'approved', 'nova versão aprovada explicitamente');
});

test('autonomia progressiva: assistido só dentro das regras; autônomo envia caso convencional', async () => {
  await sql(`update ai_workspace_settings set autonomy_mode = 'assisted', assisted_rules = '{"allowed_formations":["Duo"]}' where workspace_id = $1`, [WS]);
  const chat = '15550005017';
  await turn(chat, 'quero fechar', closeTool());
  const a = await turn(chat, 'CONFIRMO', async () => reply('x'));
  assert.equal(a.result.reason, 'awaiting_approval', 'Trio fora das regras do assistido vai para o responsável');

  await sql(`update ai_workspace_settings set autonomy_mode = 'autonomous', assisted_rules = '{}' where workspace_id = $1`, [WS]);
  const chat2 = '15550005018';
  await turn(chat2, 'quero fechar', closeTool());
  const b = await turn(chat2, 'CONFIRMO', async () => reply('x'));
  assert.equal(b.result.reason, 'precontract_auto_approved');
  assert.match(b.sent.find((s) => s.to === chat2).text, /contrato\//);
  const [cl] = await sql("select status, approval_mode from ai_closings where conversation_id = $1 and status in ('approved','link_sent')", [b.conversation.id]);
  assert.deepEqual([cl.status, cl.approval_mode], ['link_sent', 'autonomous']);

  // Exceção (sem tipo de evento identificado) nunca sai sozinha, mesmo no autônomo.
  const chat3 = '15550005019';
  await turn(chat3, 'quero fechar', async ({ executeTool }) => {
    await executeTool('preparar_fechamento', { data: DATE, horario: '16:00', formacao: 'Trio', instrumentos: 'violino, violoncelo e voz', com_som: true, recepcao_formacao: 'Duo', recepcao_horas: 2, local: 'Cidade Base' });
    return reply('x');
  });
  const c = await turn(chat3, 'CONFIRMO', async () => reply('x'));
  assert.equal(c.result.reason, 'awaiting_approval');
  assert.ok(c.result.exceptions.includes('event_type_unknown'));
  await sql(`update ai_workspace_settings set autonomy_mode = 'supervised' where workspace_id = $1`, [WS]);
});

test('contrato assinado é preservado: nova confirmação não altera o pré-contrato', async () => {
  const chat = '15550005005';
  await turn(chat, 'fechado', closeTool());
  const c = await conv(chat);
  const [signed] = await sql("insert into precontracts (workspace_id, event_date, formation, agreed_amount, status) values ($1, $2, 'Duo', 1000, 'signed') returning id", [WS, DATE]);
  await sql('update ai_conversations set precontract_id = $1 where id = $2', [signed.id, c.id]);
  const t = await turn(chat, 'CONFIRMO', async () => reply('x'));
  assert.equal(t.result.reason, 'precontract_signed');
  const [after] = await sql('select formation, agreed_amount, status from precontracts where id = $1', [signed.id]);
  assert.deepEqual([after.formation, Number(after.agreed_amount), after.status], ['Duo', 1000, 'signed']);
});

test('vocalista principal: conflito real oferece só substituto verificado; agenda inconclusiva vai para revisão sem citar nome', async () => {
  const [ev] = await sql("insert into events (workspace_id, client_name, event_date, event_time, duration_min, status) values ($1, 'Evento Sintético', $2, '16:30', 90, 'confirmado') returning id", [WS, DATE]);
  await sql("insert into event_musicians (event_id, musician_id, role, status) values ($1, $2, 'Voz', 'confirmed')", [ev.id, VOCAL_CONTACT]);
  const chat = '15550005006';
  let output = null;
  await turn(chat, 'Tem disponibilidade dia 10/06/2098 às 16h?', async ({ executeTool }) => {
    output = await executeTool('consultar_disponibilidade', { data: DATE, horario: '16:00' });
    return reply('Nessa data temos outra voz disponível.');
  });
  assert.deepEqual(output.substitutos.map((s) => s.nome), ['Vocalista Substituto Teste']);
  assert.deepEqual(output.substitutos[0].videos, ['https://video.example.test/sub']);

  await sql("update events set event_time = null where id = $1", [ev.id]);
  const chat2 = '15550005007';
  let out2 = null;
  const t2 = await turn(chat2, 'E dia 10/06/2098?', async ({ executeTool }) => {
    out2 = await executeTool('consultar_disponibilidade', { data: DATE, horario: '16:00' });
    return reply('Vou confirmar a agenda e já te retorno!');
  });
  assert.ok(!JSON.stringify(out2).includes('Vocalista'), 'não cita nomes nem indisponibilidade');
  assert.match(out2.orientacao, /Não fale de indisponibilidade/);
  assert.equal((await sql("select count(*)::int n from ai_approvals where conversation_id = $1 and kind = 'availability_review'", [t2.conversation.id]))[0].n, 1);

  // Fechamento com agenda inconclusiva não gera resumo.
  const chat3 = '15550005008';
  const t3 = await turn(chat3, 'quero fechar', closeTool());
  assert.equal(t3.conversation.needs_human, true);
  assert.equal((await sql('select count(*)::int n from ai_closings where conversation_id = $1', [t3.conversation.id]))[0].n, 0);
  await sql('delete from event_musicians where event_id = $1', [ev.id]);
  await sql('delete from events where id = $1', [ev.id]);
});

test('território bloqueado: sem orçamento e com transferência', async () => {
  const chat = '15550005009';
  let out = null;
  const t = await turn(chat, 'Quanto fica em Cidade Bloqueada?', async ({ executeTool }) => {
    out = await executeTool('calcular_orcamento', { data: DATE, formacao: 'Trio', local: 'Cidade Bloqueada' });
    return reply('Vou verificar com a equipe a possibilidade de atender esse local.');
  });
  assert.equal(out.ok, false);
  assert.equal(t.conversation.needs_human, true);
  assert.equal(t.conversation.needs_human_reason, 'territory_blocked');
  assert.ok(t.conversation.handoff_summary.includes('Cidade Bloqueada'));
});

test('conhecimento versionado: pendente não vale, aprovado entra no prompt, rollback restaura', async () => {
  const v1 = (await service.rpc('ai_knowledge_propose', { p_workspace_id: WS, p_item_key: 'pagamento', p_kind: 'policy', p_title: 'Pagamento', p_content: 'Sinal de cinquenta por cento.', p_intents: ['payment'], p_keywords: [], p_metadata: {}, p_priority: 70, p_source: 'manual', p_actor: null })).data[0];
  clearKnowledgeCache();
  const chat = '15550005010';
  const t1 = await turn(chat, 'Como funciona o pagamento?', async () => reply('Te explico!'));
  assert.ok(!t1.seen[0].system.includes('cinquenta'), 'pendente não entra');
  await service.rpc('ai_knowledge_activate', { p_workspace_id: WS, p_id: v1.id, p_actor: null });
  const v2 = (await service.rpc('ai_knowledge_propose', { p_workspace_id: WS, p_item_key: 'pagamento', p_kind: 'policy', p_title: 'Pagamento', p_content: 'Sinal de trinta por cento.', p_intents: ['payment'], p_keywords: [], p_metadata: {}, p_priority: 70, p_source: 'manual', p_actor: null })).data[0];
  await service.rpc('ai_knowledge_activate', { p_workspace_id: WS, p_id: v2.id, p_actor: null });
  clearKnowledgeCache();
  const t2 = await turn(chat, 'E o pagamento do saldo?', async () => reply('Claro!'));
  assert.ok(t2.seen[0].system.includes('trinta') && !t2.seen[0].system.includes('cinquenta'));
  await service.rpc('ai_knowledge_activate', { p_workspace_id: WS, p_id: v1.id, p_actor: null }); // rollback
  clearKnowledgeCache();
  const t3 = await turn(chat, 'pagamento pode ser parcelado?', async () => reply('Vou te explicar.'));
  assert.ok(t3.seen[0].system.includes('cinquenta'));
  const statuses = await sql("select version, status from ai_knowledge_items where workspace_id = $1 and item_key = 'pagamento' order by version", [WS]);
  assert.deepEqual(statuses.map((s) => s.status), ['active', 'archived']);
  assert.ok(t3.seen[0].input.length <= 12, 'histórico limitado (recuperação seletiva)');
});

test('aprendizado supervisionado: respostas da equipe viram sugestão recorrente; aprovação ativa exemplo', async () => {
  for (const chat of ['15550005011', '15550005012', '15550005013']) {
    await say(chat, 'Vocês tocam em igreja evangélica?');
    const echo = webhook('smb_message_echoes', { message_echoes: [{ from: '15550000000', to: chat, id: nid('wamid.echo'), timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: 'Sim! Tocamos em igrejas de todas as denominações, com repertório adequado.' } }] });
    await ingestWebhook({ supabase: service, rawBody: JSON.stringify(echo), payload: echo });
  }
  const [s] = await sql("select * from ai_learning_suggestions where workspace_id = $1 and kind = 'human_reply' and status = 'pending'", [WS]);
  assert.equal(s.occurrences, 3);
  const before = await sql("select count(*)::int n from ai_knowledge_items where workspace_id = $1 and status = 'active' and source = 'learned'", [WS]);
  assert.equal(before[0].n, 0, 'nada entra sem aprovação');
  const r = await decideSuggestion({ supabase: service, workspaceId: WS, suggestionId: s.id, decision: 'approved', actor: null, edit: {} });
  assert.equal(r.kind, 'faq');
  assert.equal((await sql("select status from ai_knowledge_items where id = $1", [r.knowledge_item_id]))[0].status, 'active');
});

test('follow-ups: agenda após resposta, cancela com resposta/humano/opt-out, template fora da janela', async () => {
  const chat = '15550005014';
  const t = await turn(chat, 'Oi! Queria saber valores para casamento', async () => reply('Oi! Que alegria! Para qual data seria?'));
  const fu = await sql("select step, status from ai_followups where conversation_id = $1 order by step", [t.conversation.id]);
  assert.deepEqual(fu.map((f) => f.status), ['scheduled', 'scheduled'], 'máximo de 2 abordagens (Manual §12)');
  const [d1, d2] = (await sql("select extract(day from due_at - now())::int as d from ai_followups where conversation_id = $1 order by step", [t.conversation.id])).map((r) => r.d);
  assert.deepEqual([d1 >= 2 && d1 <= 3, d2 - d1], [true, 5]);
  // Cliente responde => cancela; IA responde de novo => reagenda.
  await say(chat, 'Seria em junho');
  assert.ok((await sql("select status from ai_followups where conversation_id = $1", [t.conversation.id])).every((f) => f.status === 'cancelled'));
  await ready(chat);
  const h = harness(async () => reply('Ótimo! Qual cidade?'));
  await processConversationReply({ supabase: service, workspaceId: WS, conversationId: t.conversation.id, deps: h.deps });
  assert.ok((await sql("select status from ai_followups where conversation_id = $1", [t.conversation.id])).every((f) => f.status === 'scheduled'));

  // Vence o passo 1 fora da janela de 24h => sai como TEMPLATE.
  await sql("update ai_conversations set last_inbound_at = now() - interval '3 days' where id = $1", [t.conversation.id]);
  await sql("update ai_followups set due_at = now() - interval '1 minute' where conversation_id = $1 and step = 1", [t.conversation.id]);
  const cycle = harness(async () => reply('x'));
  await sql("update ai_conversations set ai_pending_since = null where workspace_id = $1", [WS]);
  const res = await runInboxCycle({ supabase: service, deps: cycle.deps });
  assert.equal(res.followups, 1);
  assert.deepEqual(cycle.sent.filter((x) => x.to === chat).map((x) => [x.kind, x.name]), [['template', 'retorno_um']]);

  // Humano assume => restantes cancelados.
  await service.rpc('ai_switch_conversation_owner', { p_workspace_id: WS, p_conversation_id: t.conversation.id, p_to_owner: 'human', p_reason: 'manual', p_actor_user_id: null });
  const left = await sql("select step, status, cancel_reason from ai_followups where conversation_id = $1 and step > 1", [t.conversation.id]);
  assert.ok(left.every((f) => f.status === 'cancelled' && f.cancel_reason === 'human_intervention'));
});

test('opt-out: confirma uma vez, cancela remarketing e impede novos follow-ups', async () => {
  const chat = '15550005015';
  await turn(chat, 'Oi, queria um orçamento', async () => reply('Oi! Para qual data?'));
  const t = await turn(chat, 'não quero mais receber mensagens', async () => { throw new Error('LLM não deve ser chamado'); });
  assert.equal(t.result.reason, 'opted_out');
  assert.equal(t.conversation.opted_out, true);
  assert.match(t.sent.find((s) => s.to === chat).text, /Não vou mais enviar/);
  assert.ok((await sql('select status from ai_followups where conversation_id = $1', [t.conversation.id])).every((f) => f.status === 'cancelled'));
  const { data } = await service.rpc('ai_schedule_followups', { p_workspace_id: WS, p_conversation_id: t.conversation.id, p_days: [1], p_templates: ['retorno_um'] });
  assert.equal(data, 0);
});

test('concorrência: dois confirmações simultâneas geram um único pré-contrato', async () => {
  const chat = '15550005016';
  await turn(chat, 'quero fechar', closeTool());
  await say(chat, 'CONFIRMO');
  await ready(chat);
  const c = await conv(chat);
  const h = harness(async () => reply('x'));
  const results = await Promise.all([1, 2, 3].map(() => processConversationReply({ supabase: service, workspaceId: WS, conversationId: c.id, deps: h.deps })));
  assert.equal(results.filter((r) => r.reason === 'awaiting_approval').length, 1);
  const [{ n }] = await sql("select count(*)::int n from precontracts p join ai_conversations a on a.precontract_id = p.id where a.id = $1", [c.id]);
  assert.equal(n, 1);
});

test('trava: resposta da IA com link de contrato é bloqueada e vai para o responsável', async () => {
  const chat = '15550005020';
  const t = await turn(chat, 'me manda o link do contrato', async () => reply('Claro! Aqui está: https://app.example.test/contrato/abc123'));
  assert.equal(t.result.reason, 'link_without_approval');
  assert.equal(t.sent.filter((s) => s.to === chat).length, 0);
  assert.equal(t.conversation.needs_human, true);
});
