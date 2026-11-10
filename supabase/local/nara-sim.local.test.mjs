// Conversas SIMULADAS da assistente (Nara) em Postgres LOCAL descartável — nada sai para o WhatsApp.
// Pipeline real (ingestão → regras → prompt → ferramentas → fechamento supervisionado → envio falso),
// com dados 100% sintéticos (nomes, preços, datas e números inventados).
//
// Modos:
//  - padrão (CI): modelo ROTEIRIZADO — prova a lógica do sistema em volta do modelo.
//  - NARA_SIM_LLM=openai + OPENAI_API_KEY: modelo REAL (custa tokens); as verificações viram critérios de
//    qualidade e a transcrição é gravada em NARA_SIM_OUT (fora do repositório).
//
// Rodar: ./supabase/local/run-ai-inbox.sh (inclui este arquivo).
import test from 'node:test';
import { semanticLlm } from '../../tests/helpers/semantic-llm.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createPgSupabase } from './pg-supabase.mjs';
import { encryptSecret } from '../../lib/ai/inbox/secret-box.mjs';
import { ingestWebhook, processConversationReply, dispatchOutbox } from '../../lib/ai/inbox/service.mjs';
import { generateReply as realGenerateReply } from '../../lib/ai/agent/llm.mjs';
import { clearKnowledgeCache } from '../../lib/ai/commercial/engine.mjs';

const DB_URL = process.env.LOCAL_DB_URL || 'postgresql://postgres@localhost/harmonics_local?host=/tmp&port=54329';
if (decodeURIComponent(new URL(DB_URL).pathname.slice(1)) !== 'harmonics_local') throw new Error('nara-sim: use somente o banco descartável harmonics_local.');
const pg = (await import(process.env.PG_MODULE || 'pg')).default;
const pool = new pg.Pool({ connectionString: DB_URL, max: 5 });
const service = createPgSupabase({ pool, role: 'service_role' });
const sql = async (text, params) => (await pool.query(text, params)).rows;

const REAL = process.env.NARA_SIM_LLM === 'openai' && Boolean(process.env.OPENAI_API_KEY);
const KEY = Buffer.alloc(32, 7).toString('base64');
const ENV = {
  AI_INBOX_AI_ENABLED: 'true', AI_CHANNEL_ENCRYPTION_KEY: KEY, NEXT_PUBLIC_APP_URL: 'https://app.example.test',
  OPENAI_API_KEY: REAL ? process.env.OPENAI_API_KEY : 'sk-test', AI_INBOX_MODEL: process.env.AI_INBOX_MODEL || '',
};
const WS = '00000000-0000-4000-8000-0000000000b1';
const PN = '900000000201';
const ASSISTANT = 'Lia';
const COMPANY = 'Conjunto Exemplo';
let seq = 0;
const nid = (p) => `${p}.${Date.now()}.${(seq += 1)}`;
const transcript = [];

function webhook(value) {
  return { object: 'whatsapp_business_account', entry: [{ id: 'waba-sim', changes: [{ field: 'messages', value: { metadata: { phone_number_id: PN, display_phone_number: '15550000000' }, ...value } }] }] };
}
async function conv(chat) { return (await sql('select * from ai_conversations where workspace_id = $1 and provider_chat_id = $2', [WS, chat]))[0]; }
const reply = (text, toolCalls = []) => ({ text, model: 'roteiro', inputTokens: 10, outputTokens: 5, costUsd: 0, toolCalls });

/** Um turno: cliente fala → pipeline real → "envio" falso. `script` é o modelo roteirizado do turno. */
async function turn(scenario, chat, text, script) {
  const payload = webhook({ messages: [{ from: chat, id: nid('wamid.in'), timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: text } }] });
  await ingestWebhook({ supabase: service, rawBody: JSON.stringify(payload), payload });
  await sql("update ai_conversations set ai_pending_since = now() - interval '10 seconds' where workspace_id = $1 and provider_chat_id = $2", [WS, chat]);
  const sent = []; const seen = []; const toolOutputs = [];
  const deps = {
    env: ENV, routeFn: null, notifyAdmin: async () => ({ ok: true }),
    sendTextMessage: async ({ to, text: body }) => { const id = nid('wamid.out'); sent.push({ to, text: body }); return { status: 'sent', providerMessageId: id }; },
    sendTemplateMessage: async () => { throw new Error('template não deve sair na simulação'); },
    generateReply: async (args) => {
      seen.push(args);
      const executeTool = async (name, a) => { const out = await args.executeTool(name, a); toolOutputs.push({ name, args: a, out }); return out; };
      if (REAL) return realGenerateReply({ ...args, executeTool, env: ENV });
      return semanticLlm(script || (async () => reply('Combinado!')))({ ...args, executeTool });
    },
  };
  const c = await conv(chat);
  const result = await processConversationReply({ supabase: service, workspaceId: WS, conversationId: c.id, deps });
  await dispatchOutbox({ supabase: service, workspaceId: WS, deps });
  const out = sent.filter((s) => s.to === chat).map((s) => s.text).join('\n');
  transcript.push({ scenario, customer: text, assistant: out, status: result.status, reason: result.reason || null, tools: toolOutputs.map((t) => t.name) });
  return { result, sent, seen, out, toolOutputs, conversation: await conv(chat) };
}

test.before(async () => {
  await sql('delete from workspaces where id = $1', [WS]);
  await sql("insert into workspaces (id, key, name, slug) values ($1, 'ws-nara-sim', 'Workspace Simulação', 'ws-nara-sim')", [WS]);
  const [tpl] = await sql("insert into contract_templates (workspace_id, name, slug, is_active, content) values ($1, 'Modelo Casamento Sim', 'casamento-sim', true, '<p>Cláusula sintética.</p>') returning id", [WS]);
  await sql("insert into event_types (workspace_id, name, slug, is_active, default_contract_template_id) values ($1, 'Casamento', 'casamento-sim', true, $2)", [WS, tpl.id]);
  await sql("insert into ai_channels (workspace_id, phone_number_id, access_token_encrypted, status) values ($1, $2, $3, 'active')", [WS, PN, await encryptSecret('token-sintetico-simulacao-0001', KEY)]);
  await sql(`insert into ai_workspace_settings (workspace_id, ai_enabled, mode, autonomy_mode, assistant_name, assistant_company, handoff_contact_name, followup_enabled)
             values ($1, true, 'auto', 'supervised', $2, $3, 'Responsável Teste', false)`, [WS, ASSISTANT, COMPANY]);
  // Tabela sintética: troca de vigência em 2091-06-01; som por duração com técnico interno (margem 500).
  await sql(`insert into quote_price_rules (workspace_id, category, item_key, label, amount, valid_from, valid_until) values
    ($1,'ceremony','trio','Trio',1110,'2080-01-01','2091-05-31'), ($1,'ceremony','trio','Trio',1330,'2091-06-01',null),
    ($1,'reception','trio_1h','Trio 1h',410,'2080-01-01',null), ($1,'reception','trio_3h','Trio 3h',910,'2080-01-01',null),
    ($1,'sound','church','Som',610,'2080-01-01',null), ($1,'sound','church_reception_1h','Som 1h',720,'2080-01-01',null),
    ($1,'sound','church_reception_2h','Som 2h',830,'2080-01-01',null),
    ($1,'musician_fee','sound_tech','Técnico',110,'2080-01-01',null), ($1,'musician_fee','sound_tech_reception_1h','Técnico 1h',220,'2080-01-01',null),
    ($1,'musician_fee','musician_local','Cachê',90,'2080-01-01',null)`, [WS]);
  await sql("insert into ai_service_areas (workspace_id, name, status) values ($1,'Cidade Base','served')", [WS]);
  // Agenda: vocalista principal sintético (sem ele, todo fechamento vai para revisão de agenda).
  const VOCAL = '00000000-0000-4000-8000-0000000000b9';
  await sql("insert into contacts (id, workspace_id, name, contact_type) values ($1,$2,'Vocalista Sintético','musician')", [VOCAL, WS]);
  await sql("insert into ai_musician_profiles (workspace_id, contact_id, display_name, roles, is_primary_vocal, video_urls) values ($1,$2,'Vocalista Sintético','{vocal}',true,'{}')", [WS, VOCAL]);
  clearKnowledgeCache();
});
test.after(async () => {
  await pool.end();
  if (process.env.NARA_SIM_OUT) fs.writeFileSync(process.env.NARA_SIM_OUT, JSON.stringify({ mode: REAL ? 'openai' : 'roteiro', transcript }, null, 2));
});

test('1º contato já pedindo orçamento: apresenta uma vez, resposta objetiva pela tabela vigente na data', async () => {
  const chat = '15550007001';
  const t1 = await turn('orcamento-direto', chat, 'Oi! Quanto fica um trio com som para casamento em 10/03/2091 na Cidade Base?', async ({ executeTool }) => {
    const q = await executeTool('calcular_orcamento', { formacao: 'Trio', data: '2091-03-10', com_som: true, local: 'Cidade Base' });
    return reply(`Oi! Sou a ${ASSISTANT}, assistente da ${COMPANY} ☺️ Veja a referência para essa data:`, ['calcular_orcamento']);
  });
  const prompt1 = t1.seen[0]?.system || '';
  assert.match(prompt1, new RegExp(`Você é ${ASSISTANT}, assistente virtual da ${COMPANY}`));
  assert.match(prompt1, /Primeira resposta/);
  assert.match(prompt1, /ORÇAMENTO INICIAL/);
  if (!REAL) {
    const q = t1.toolOutputs.find((t) => t.name === 'calcular_orcamento').out;
    assert.match(t1.out, /Total de referência: R\$ 1\.720,00/, 'cerimônia 1.110 + som 610 (tabela antiga na data)');
    assert.equal(q.orcamento_pronto, true);
    assert.equal(q.requer_aprovacao, false);
    assert.ok(!JSON.stringify(q).match(/internalCost|margin|musician_fee|sound_tech|técnico|R\$ 110,00|R\$ 90,00/i), 'ferramenta não devolve custo interno ao modelo');
    assert.match(t1.out, new RegExp(`Sou a ${ASSISTANT}`));
  } else {
    assert.ok(t1.out.includes(ASSISTANT), 'modelo real se apresenta no 1º contato');
  }
  const t2 = await turn('orcamento-direto', chat, 'E se for em julho de 2091, com 1h de receptivo?', async ({ executeTool }) => {
    const q = await executeTool('calcular_orcamento', { formacao: 'Trio', data: '2091-07-10', com_som: true, recepcao_horas: 1, local: 'Cidade Base' });
    return reply('Em julho, com uma hora de receptivo:', ['calcular_orcamento']);
  });
  const prompt2 = t2.seen[0]?.system || '';
  assert.doesNotMatch(prompt2, /Primeiro contato/, 'sem nova apresentação depois da primeira resposta');
  assert.match(prompt2, /Você já se apresentou/);
  if (!REAL) {
    const q = t2.toolOutputs.find((t) => t.name === 'calcular_orcamento').out;
    assert.match(t2.out, /Total de referência: R\$ 2\.460,00/, 'tabela nova 1.330 + receptivo 410 + som com 1h 720');
    assert.equal(q.orcamento_pronto, true);
  } else {
    assert.ok(!t2.out.includes(`Sou a ${ASSISTANT}`), 'modelo real não se reapresenta');
  }
});

test('som com receptivo acima de 2h: sem preço automático, vai para aprovação', async () => {
  const chat = '15550007002';
  const t = await turn('som-longo', chat, 'Trio com som e 3h de receptivo em 10/03/2091 na Cidade Base, quanto fica?', async ({ executeTool }) => {
    const q = await executeTool('calcular_orcamento', { formacao: 'Trio', data: '2091-03-10', com_som: true, recepcao_horas: 3, local: 'Cidade Base' });
    return reply(q.total ? `Total ${q.total}` : 'Vou confirmar o valor do som com a equipe.', ['calcular_orcamento']);
  });
  if (!REAL) {
    const q = t.toolOutputs.find((x) => x.name === 'calcular_orcamento').out;
    assert.equal(q.requer_aprovacao, true);
    assert.equal(q.total, undefined, 'valores não são reescritos pelo modelo');
    assert.doesNotMatch(t.out, /Total de referência/, 'sem total definitivo');
  }
  const approvals = await sql("select kind, summary from ai_approvals where workspace_id = $1 and conversation_id = $2", [WS, t.conversation.id]);
  if (!REAL || t.toolOutputs.some((x) => x.name === 'calcular_orcamento')) assert.ok(approvals.some((a) => a.kind === 'pricing_exception' && /sound_duration_requires_validation/.test(a.summary)));
});

test('desconto segue a negociação; pedido de pessoa transfere; link de contrato nunca sai pela IA', async () => {
  const chat = '15550007003';
  const d = await turn('negociacao', chat, 'Achei caro, consegue um desconto?', async () => reply('Entendo! Uma facilidade é dividir o pagamento.'));
  assert.notEqual(d.result.status, 'handoff', 'desconto não transfere de imediato');
  const link = await turn('negociacao', chat, 'Me manda o contrato então', async () => reply('Segue: https://app.example.test/contrato/abc123'));
  if (!REAL) {
    assert.equal(link.result.reason, 'link_without_approval');
    assert.equal(link.out, '', 'nada enviado');
  }
  assert.equal((await conv(chat)).needs_human, true, 'depois do bloqueio a conversa fica com a equipe');
  const other = '15550007013';
  const h = await turn('pedido-humano', other, 'Quero falar com uma pessoa, por favor', null);
  assert.equal(h.result.status, 'handoff');
  assert.equal((await conv(other)).needs_human, true);
});

test('fechamento supervisionado: resumo determinístico, CONFIRMO prepara o pré-contrato e nenhum link sai sem aprovação', async () => {
  const chat = '15550007004';
  const f = await turn('fechamento', chat, 'Quero fechar!', async ({ executeTool }) => {
    await executeTool('registrar_dados_evento', { tipo_evento: 'Casamento', data_evento: '2091-03-10', horario: '16:00', formacao: 'Trio', cidade: 'Cidade Base', local: 'Espaço Sintético', endereco: 'Rua Sintética 101, Cidade Base' });
    await executeTool('preparar_fechamento', { data: '2091-03-10', horario: '16:00', formacao: 'Trio', instrumentos: 'violino, violoncelo e voz', com_som: true, local: 'Cidade Base' });
    return reply('(texto do modelo ignorado)', ['preparar_fechamento']);
  });
  if (!REAL) {
    assert.match(f.out, /10\/03\/2091 às 16:00/, 'resumo determinístico com data e horário');
    assert.doesNotMatch(f.out, /texto do modelo/, 'texto do modelo nunca substitui o resumo');
  }
  const c = await turn('fechamento', chat, 'CONFIRMO', async () => { throw new Error('modelo não é chamado na confirmação'); });
  if (!REAL) {
    assert.equal(c.result.reason, 'awaiting_approval');
    assert.doesNotMatch(c.out, /contrato\//);
    const [cl] = await sql("select status from ai_closings where conversation_id = $1 order by created_at desc limit 1", [c.conversation.id]);
    assert.equal(cl.status, 'awaiting_approval');
  }
});

test('opt-out encerra acompanhamento; IA desligada globalmente não gera nada', async () => {
  const chat = '15550007005';
  const o = await turn('opt-out', chat, 'não quero mais receber mensagens', null);
  assert.equal(o.result.status === 'opted_out' || /opt/i.test(String(o.result.reason || o.result.status)), true);
  const off = { ...ENV, AI_INBOX_AI_ENABLED: 'false' };
  const chat2 = '15550007006';
  const payload = webhook({ messages: [{ from: chat2, id: nid('wamid.in'), timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: 'Oi' } }] });
  await ingestWebhook({ supabase: service, rawBody: JSON.stringify(payload), payload });
  const c2 = await conv(chat2);
  let called = false;
  const r = await processConversationReply({ supabase: service, workspaceId: WS, conversationId: c2.id, deps: { env: off, generateReply: async () => { called = true; return reply('x'); } } });
  assert.equal(r.reason, 'global_ai_disabled');
  assert.equal(called, false);
});

