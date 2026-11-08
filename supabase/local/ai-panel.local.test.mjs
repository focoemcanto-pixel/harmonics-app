// Painel Inteligência Comercial com handlers REAIS de /api/ai/* contra Postgres local.
// Única simulação: a sessão (Owner sintético) e o cliente Supabase (→ Postgres local).
// Valida inicialização da base (prévia, sugestões pendentes com origem, sem valores dinâmicos,
// idempotência, sem duplicar, configurações preservadas) e aprovação/versão/rollback.
// Rodar: ./supabase/local/run-ai-inbox.sh (usa --import ./supabase/local/panel/register.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from './panel/server.mjs';
import { panelPool as pool } from './panel/supabase-admin.stub.mjs';
import { buildCommercialContext, clearKnowledgeCache } from '../../lib/ai/commercial/engine.mjs';
import { getSupabaseAdmin } from './panel/supabase-admin.stub.mjs';

const WS = process.env.PANEL_WORKSPACE_ID;
const sql = async (q, p) => (await pool.query(q, p)).rows;
const call = async (method, path, body, auth = 'owner') => {
  const out = await handle(method, path, '', body ? JSON.stringify(body) : undefined, { 'content-type': 'application/json', 'x-test-auth': auth });
  return { status: out.status, body: JSON.parse(out.body || '{}') };
};

test.before(async () => {
  await sql('delete from workspaces where id = $1', [WS]);
  await sql("insert into workspaces (id, key, name, slug) values ($1, 'ws-panel-test', 'Workspace Painel Teste', 'ws-panel-test')", [WS]);
  await sql("insert into ai_workspace_settings (workspace_id, ai_enabled, mode, assistant_name, followup_enabled) values ($1, false, 'observe', 'Assistente Teste', false)", [WS]);
  await sql("insert into event_types (workspace_id, name, slug, description, is_active) values ($1, 'Casamento', 'casamento', 'Cerimônia religiosa ou civil', true), ($1, 'Aniversário', 'aniversario', null, true), ($1, 'Inativo', 'inativo', null, false)", [WS]);
  await sql(`insert into contract_templates (workspace_id, name, slug, is_active, is_default, content) values ($1, 'Modelo Teste', 'modelo-teste', true, true, $2)`, [WS,
    '<p>CLÁUSULA 3 — O pagamento será feito com sinal de {{valor_sinal}} na assinatura e saldo de R$ 1.500,00 até 7 dias antes do evento, via PIX.</p>'
    + '<p>CLÁUSULA 5 — Em caso de cancelamento pelo CONTRATANTE com menos de 30 dias, o sinal não será devolvido; remarcação sujeita à agenda.</p>'
    + '<p>CLÁUSULA 6 — O CONTRATANTE disponibilizará ponto de energia 220V a até 10 metros e cobertura em caso de área externa.</p>'
    + '<p>Data do evento: 10/06/2098, contato (11) 91234-5678, email teste@example.test.</p>']);
  await sql(`insert into message_templates (workspace_id, key, name, channel, recipient_type, body, is_active) values
    ($1, 'repertoire_pending_15_days_client_whatsapp', 'Repertório pendente', 'whatsapp', 'client', 'Olá {{nome_cliente}}! Faltam 15 dias para o seu evento. Acesse {{link_painel_cliente}} para montar o repertório do cortejo e da entrada.', true),
    ($1, 'invite_member_whatsapp', 'Convite músico', 'whatsapp', 'member', 'Olá {{nome}}, convite para o evento.', true)`, [WS]);
  await sql("insert into suggestion_moments (name, slug, is_active, sort_order) values ('Entrada Sintética', 'entrada-sintetica', true, 1), ('Cortejo Sintético', 'cortejo-sintetico', true, 2) on conflict do nothing");
  await sql("insert into events (workspace_id, client_name, event_date, location_address) values ($1, 'Evento Sintético A', '2098-01-01', 'Rua 1, 100 - Cidade Alfa - BA'), ($1, 'Evento Sintético B', '2098-01-02', 'Av. 2 - Cidade Alfa - BA'), ($1, 'Evento Sintético C', '2098-01-03', 'Praça 3, Cidade Beta, BA')", [WS]);
  await sql("insert into ai_service_areas (workspace_id, name, status) values ($1, 'Cidade Beta - BA', 'served')", [WS]);
  // Conteúdo já ensinado manualmente (deve evitar duplicação).
  await sql(`insert into ai_knowledge_items (workspace_id, item_key, kind, title, content, status) values
    ($1, 'manual-painel', 'post_sale', 'Painel', $2, 'active')`, [WS,
    'Depois do contrato assinado o cliente recebe um link individual do painel. Lá ele monta o repertório por momento (entrada, cortejo, saída e demais momentos), vê sugestões por momento, busca músicas pelo YouTube, anota trechos e observações, acompanha pagamentos e envia comprovantes. Envie somente o link individual do próprio cliente (obter_link_cliente). Se precisar de ajuda para montar o repertório, ofereça uma reunião com a equipe.']);
  clearKnowledgeCache();
});
test.after(async () => { await pool.end(); });

test('autorização: sem sessão 401; sem admin 403', async () => {
  assert.equal((await call('GET', '/api/ai/knowledge/bootstrap', null, 'none')).status, 401);
  assert.equal((await call('POST', '/api/ai/knowledge/bootstrap', null, 'viewer')).status, 403);
});

let created = [];

test('prévia não grava; criação gera sugestões PENDENTES com origem e sem valores dinâmicos', async () => {
  const before = (await sql('select count(*)::int n from ai_knowledge_items where workspace_id = $1', [WS]))[0].n;
  const preview = await call('GET', '/api/ai/knowledge/bootstrap');
  assert.equal(preview.status, 200);
  assert.ok(preview.body.created.length >= 6, `prévia com ${preview.body.created.length}`);
  assert.equal((await sql('select count(*)::int n from ai_knowledge_items where workspace_id = $1', [WS]))[0].n, before, 'prévia não grava');

  const res = await call('POST', '/api/ai/knowledge/bootstrap');
  created = res.body.created;
  assert.equal(created.length, preview.body.created.length);
  const rows = await sql("select * from ai_knowledge_items where workspace_id = $1 and source = 'import'", [WS]);
  assert.equal(rows.length, created.length);
  assert.ok(rows.every((r) => r.status === 'pending_approval' && r.version === 1), 'nada é aprovado automaticamente');
  assert.ok(rows.every((r) => r.metadata?.origin?.table && r.metadata.origin.imported_by === 'bootstrap'), 'origem identificada');
  const all = rows.map((r) => r.content).join('\n');
  assert.ok(!/R\$\s*\d/.test(all), 'sem preço copiado');
  assert.ok(!/\{\{/.test(all), 'sem variáveis de template');
  assert.ok(!/10\/06\/2098|91234|teste@example/.test(all), 'sem datas, telefones ou e-mails');
  const kinds = new Set(rows.map((r) => r.kind));
  for (const k of ['faq', 'policy', 'rider', 'post_sale', 'rule']) assert.ok(kinds.has(k), `tipo ${k}`);
  assert.ok(rows.some((r) => r.title === 'Tipos de evento atendidos' && r.content.includes('Casamento') && !r.content.includes('Inativo')));
  assert.ok(!rows.some((r) => /Convite músico/.test(r.title)), 'mensagens internas (músicos) não entram');
  const payment = rows.find((r) => r.title === 'Condições de pagamento');
  assert.deepEqual(payment.metadata.removed_dynamic.sort(), ['currency', 'template_variable']);
});

test('idempotente e sem duplicar conteúdo já ensinado; localidades só como sugestão', async () => {
  const again = await call('POST', '/api/ai/knowledge/bootstrap');
  assert.equal(again.body.created.length, 0);
  assert.ok(again.body.skipped.every((s) => ['already_imported', 'duplicate_content'].includes(s.reason)));
  const preview = await call('GET', '/api/ai/knowledge/bootstrap');
  assert.ok(preview.body.skipped.some((s) => s.reason === 'duplicate_content' && s.title.startsWith('Painel do cliente')), 'conteúdo manual não é duplicado');
  assert.deepEqual(preview.body.areaSuggestions, [{ name: 'Cidade Alfa - BA', events: 2 }], 'área já cadastrada não é sugerida');
  assert.equal((await sql('select count(*)::int n from ai_service_areas where workspace_id = $1', [WS]))[0].n, 1, 'nenhuma área criada automaticamente');
  const [s] = await sql('select ai_enabled, mode, assistant_name, followup_enabled, autonomous_closing_enabled from ai_workspace_settings where workspace_id = $1', [WS]);
  assert.deepEqual(s, { ai_enabled: false, mode: 'observe', assistant_name: 'Assistente Teste', followup_enabled: false, autonomous_closing_enabled: false }, 'configurações preservadas');
});

test('aprovação, nova versão e rollback pelo painel; só o ativo chega à IA', async () => {
  const payment = created.find((c) => c.title === 'Condições de pagamento');
  const ctx = async () => {
    clearKnowledgeCache();
    const conv = { id: null, sales_stage: 'qualifying', lead_data: {} };
    return buildCommercialContext({ supabase: getSupabaseAdmin(), workspaceId: WS, conversation: conv, latestText: 'Como funciona o pagamento?', settings: {}, customerStatus: 'lead' });
  };
  assert.ok(!(await ctx()).knowledgeText.includes('Condições de pagamento'), 'pendente não chega à IA');

  assert.equal((await call('POST', `/api/ai/knowledge/${payment.id}`, { action: 'approve' })).status, 200);
  assert.ok((await ctx()).knowledgeText.includes('Condições de pagamento'));

  const v2 = await call('POST', '/api/ai/knowledge', { item_key: payment.item_key, kind: 'policy', title: 'Condições de pagamento', content: 'Sinal na assinatura e saldo até a semana do evento, por PIX ou transferência.', intents: 'payment', priority: 70 });
  assert.deepEqual([v2.status, v2.body.version, v2.body.status], [200, 2, 'pending_approval']);
  assert.ok(!(await ctx()).knowledgeText.includes('semana do evento'), 'v2 pendente não substitui v1');
  await call('POST', `/api/ai/knowledge/${v2.body.id}`, { action: 'approve' });
  assert.ok((await ctx()).knowledgeText.includes('semana do evento'));

  await call('POST', `/api/ai/knowledge/${payment.id}`, { action: 'rollback' });
  const versions = await sql('select version, status from ai_knowledge_items where workspace_id = $1 and item_key = $2 order by version', [WS, payment.item_key]);
  assert.deepEqual(versions.map((v) => [v.version, v.status]), [[1, 'active'], [2, 'archived']]);
  assert.ok(!(await ctx()).knowledgeText.includes('semana do evento'), 'rollback restaurou v1');

  const list = await call('GET', '/api/ai/knowledge');
  assert.ok(list.body.items.filter((i) => i.item_key === payment.item_key).length === 2, 'histórico de versões preservado');
  const reject = created.find((c) => c.kind === 'style' || c.title.startsWith('Mensagem oficial'));
  if (reject) {
    await call('POST', `/api/ai/knowledge/${reject.id}`, { action: 'reject' });
    assert.equal((await sql('select status from ai_knowledge_items where id = $1', [reject.id]))[0].status, 'rejected');
  }
  const active = await sql("select count(*)::int n from ai_knowledge_items where workspace_id = $1 and source = 'import' and status = 'active'", [WS]);
  assert.equal(active[0].n, 1, 'somente o que foi aprovado está ativo');
});
