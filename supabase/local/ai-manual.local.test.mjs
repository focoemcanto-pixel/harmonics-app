// Manual Mestre v2.1 com handlers REAIS de /api/ai/* contra Postgres local (sessão sintética).
// Valida: autonomia liberada só pelo Owner (com confirmação e auditoria), importação do manual
// (conhecimento e tabelas PENDENTES, cachês fora do conhecimento), aprovação de tabela pelo Owner
// sem sobrescrever regra oficial, preço por faixa/modalidade, aprovação de contrato pela API,
// filas da Central, lembretes de assinatura e vínculo de participante. Dados 100% sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from './panel/server.mjs';
import { panelPool as pool, getSupabaseAdmin } from './panel/supabase-admin.stub.mjs';
import { quoteForWorkspace } from '../../lib/ai/commercial/pricing.mjs';
import { executeTool } from '../../lib/ai/agent/tools.mjs';
import { markLinkSent } from '../../lib/ai/commercial/supervision.mjs';

const WS = process.env.PANEL_WORKSPACE_ID;
const sql = async (q, p) => (await pool.query(q, p)).rows;
const call = async (method, path, body, auth = 'owner') => {
  const out = await handle(method, path, '', body ? JSON.stringify(body) : undefined, { 'content-type': 'application/json', 'x-test-auth': auth });
  return { status: out.status, body: JSON.parse(out.body || '{}') };
};

// Manual sintético no mesmo formato do Manual Mestre (valores e nomes inventados).
const MANUAL = `# MANUAL SINTÉTICO
## Sumário
1. Identidade
---
## 1. Identidade e postura da assistente
Tom natural e próximo. A assistente informa que é IA quando apropriado.
## 4. Tabelas de cerimônia
### 4.1 Região-base Cidade Teste — tabela até maio de 2097
| Formação | Valor |
|---|---:|
| Duo | R$ 1.000 |
| Trio | R$ 1.500 |
### 4.3 Regiões metropolitanas
| Formação | Valor |
|---|---:|
| Duo | R$ 1.100 |
| Trio | R$ 1.650 |
**PENDENTE:** confirmar vigência temporal.
## 5. Região, deslocamento e logística
Fora da região-base acrescentar **R$ 150 de deslocamento da banda**. Sonorização própria: **outros R$ 120 de deslocamento da equipe de som** nas mesmas condições.
## 6. Sonorização
Para **cerimônia na região-base**, a referência comercial de sonorização é **R$ 600**, separada da música.
## 7. Receptivo vinculado à cerimônia
| Formação | 1 hora | 2 horas |
|---|---:|---:|
| Dupla | R$ 400 | R$ 700 |
## 8. Apresentações avulsas por tempo — aniversários
| Formação | 1 hora | 2 horas |
|---|---:|---:|
| Trio | R$ 1.300 | R$ 1.800 |
## 9. Cálculo de cachês, resultado e margem
### 9.1 Cachês-base informados
| Profissional contratado | Região-base | Fora da região-base, até ~2h |
|---|---:|---:|
| Músico comum | R$ 300 | R$ 330 |
| Tecladista/subgerente | R$ 340 | R$ 370 |
### 9.3 Adicionais
Acrescentar **R$ 80 por hora de receptivo por músico efetivamente escalado**.
## 10. Negociação e condições de pagamento
Condição padrão: 50% até duas semanas antes e 50% até dois dias antes.
## 20. Painel de supervisão e autonomia progressiva
Especificação do sistema (não é conhecimento de atendimento).
## 23. Exemplos de mensagens
### 23.1 Pedido de orçamento
> Oi! Me passa a data e o local que envio as opções por aqui.
`;

test.before(async () => {
  await sql('delete from workspaces where id = $1', [WS]);
  await sql("insert into workspaces (id, key, name, slug) values ($1, 'ws-manual-test', 'Workspace Manual Teste', 'ws-manual-test')", [WS]);
  await sql("insert into ai_workspace_settings (workspace_id, ai_enabled, mode) values ($1, false, 'observe')", [WS]);
  await sql("insert into ai_service_areas (workspace_id, name, status, price_tier) values ($1, 'Cidade Teste', 'served', null), ($1, 'Cidade Metro', 'served', 'metro')", [WS]);
});
test.after(async () => { await pool.end(); });

test('autonomia: padrão supervisionado; só o Owner libera, com confirmação; admin pode revogar; tudo auditado', async () => {
  assert.equal((await call('GET', '/api/ai/autonomy')).body.mode, 'supervised');
  assert.equal((await call('PUT', '/api/ai/autonomy', { mode: 'autonomous', confirm: 'LIBERAR AUTONOMIA' }, 'admin')).status, 403);
  assert.equal((await call('PUT', '/api/ai/autonomy', { mode: 'assisted' })).body.code, 'CONFIRMATION_REQUIRED');
  const ok = await call('PUT', '/api/ai/autonomy', { mode: 'assisted', confirm: 'LIBERAR AUTONOMIA', rules: { allowed_formations: 'Duo, Trio', max_total: '5000' }, reason: 'teste' });
  assert.deepEqual([ok.status, ok.body.rules.allowed_formations, ok.body.rules.max_total], [200, ['Duo', 'Trio'], 5000]);
  assert.equal((await call('PUT', '/api/ai/autonomy', { mode: 'supervised' }, 'admin')).status, 200, 'revogação imediata por admin');
  const events = await sql('select from_mode, to_mode from ai_autonomy_events where workspace_id = $1 order by created_at', [WS]);
  assert.deepEqual(events.map((e) => `${e.from_mode}>${e.to_mode}`), ['supervised>assisted', 'assisted>supervised']);
});

test('importação do manual: prévia, conhecimento e tabelas pendentes, cachês fora do conhecimento, idempotente', async () => {
  const preview = await call('POST', '/api/ai/manual/import', { markdown: MANUAL, dry_run: true });
  assert.equal(preview.status, 200);
  assert.equal((await sql('select count(*)::int n from ai_pricing_proposals where workspace_id = $1', [WS]))[0].n, 0, 'prévia não grava');
  const res = await call('POST', '/api/ai/manual/import', { markdown: MANUAL, dry_run: false });
  const k = await sql("select * from ai_knowledge_items where workspace_id = $1 and metadata->'origin'->>'table' = 'manual'", [WS]);
  assert.ok(k.length >= 6 && k.every((i) => i.status === 'pending_approval'));
  assert.ok(!k.some((i) => /R\$\s*\d|300|330|340|370/.test(i.content)), 'nenhum valor/cachê em texto de conhecimento');
  assert.ok(k.some((i) => i.title === 'Sigilo comercial (cachês e margens)'));
  assert.ok(!k.some((i) => /Painel de supervisão/.test(i.title)), 'especificação do sistema não vira conhecimento');
  assert.ok(k.find((i) => i.title.startsWith('Tabelas de cerimônia')).metadata.review.required, 'PENDENTE exige revisão');
  const p = await sql('select category, item_key, amount, valid_until, metadata from ai_pricing_proposals where workspace_id = $1 order by category, item_key', [WS]);
  const map = Object.fromEntries(p.map((x) => [`${x.category}/${x.item_key}`, Number(x.amount)]));
  assert.deepEqual(
    [map['ceremony/duo'], map['ceremony/trio@metro'], map['reception/duo_2h'], map['other/show:trio_2h'], map['sound/church'], map['transport/band_trip'], map['transport/sound_trip'], map['musician_fee/keyboard_outside'], map['musician_fee/reception_extra_hour']],
    [1000, 1650, 700, 1800, 600, 150, 120, 370, 80],
  );
  assert.equal(p.find((x) => x.item_key === 'duo' && x.category === 'ceremony').valid_until.toISOString().slice(0, 10), '2097-05-31');
  assert.ok(p.filter((x) => x.category === 'musician_fee').every((x) => x.metadata.internal));
  assert.equal(res.body.pricing.length, p.length);
  // Cada proposta chega organizada contra as regras oficiais (aqui não há regras: tudo "novo").
  assert.ok(p.every((x) => x.metadata.review?.status && Array.isArray(x.metadata.official)));
  const again = await call('POST', '/api/ai/manual/import', { markdown: MANUAL, dry_run: false });
  assert.deepEqual([again.body.knowledge.length, again.body.pricing.length], [0, 0], 'idempotente');
});

test('tabelas: só o Owner aprova, vigência obrigatória, sem sobrescrever regra oficial; preço por faixa e por tempo', async () => {
  const props = (await call('GET', '/api/ai/pricing-proposals')).body.proposals;
  const byKey = (c, k) => props.find((x) => x.category === c && x.item_key === k);
  assert.equal((await call('POST', `/api/ai/pricing-proposals/${byKey('ceremony', 'trio@metro').id}`, { decision: 'approved' }, 'admin')).status, 403);
  assert.equal((await call('POST', `/api/ai/pricing-proposals/${byKey('ceremony', 'trio@metro').id}`, { decision: 'approved' })).body.code, 'VALID_FROM_REQUIRED');
  for (const [c, k] of [['ceremony', 'trio'], ['ceremony', 'trio@metro'], ['transport', 'band_trip'], ['transport', 'sound_trip'], ['sound', 'church'], ['other', 'show:trio_2h']]) {
    const r = await call('POST', `/api/ai/pricing-proposals/${byKey(c, k).id}`, { decision: 'approved', valid_from: '2020-01-01' });
    assert.equal(r.status, 200, `${c}/${k}`);
  }
  const audit = await sql("select item_key, action, reason, new_rule from quote_price_rule_changes where workspace_id = $1 and reason like 'Aprovação de proposta%'", [WS]);
  assert.equal(audit.length, 6, 'cada aprovação de proposta entra no histórico auditado');
  assert.ok(audit.every((a) => a.action === 'new_validity' && a.new_rule.valid_from === '2020-01-01'));
  await sql("insert into ai_pricing_proposals (workspace_id, source, category, item_key, label, amount) values ($1, 'teste', 'ceremony', 'trio', 'Trio duplicado', 9999)", [WS]);
  const dup = (await call('GET', '/api/ai/pricing-proposals')).body.proposals.find((x) => x.source === 'teste');
  assert.equal((await call('POST', `/api/ai/pricing-proposals/${dup.id}`, { decision: 'approved', valid_from: '2020-01-01' })).body.code, 'RULE_EXISTS');

  const supabase = getSupabaseAdmin();
  const base = await quoteForWorkspace({ supabase, workspaceId: WS, input: { date: '2096-03-01', formation: 'Trio', instruments: 'voz, teclado, violino', hasSound: true, location: 'Cidade Teste' } });
  assert.deepEqual(base.items.map((i) => [i.key, i.amount]), [['ceremony', 1500], ['sound', 600]]);
  const metro = await quoteForWorkspace({ supabase, workspaceId: WS, input: { date: '2096-03-01', formation: 'Trio', hasSound: true, location: 'Cidade Metro' } });
  assert.deepEqual(metro.items.map((i) => [i.key, i.amount]), [['ceremony', 1650], ['sound', 600], ['travel', 150], ['sound_travel', 120]]);
  const show = await quoteForWorkspace({ supabase, workspaceId: WS, input: { date: '2096-03-01', formation: 'Trio', modality: 'show', hours: 2, hasSound: true, location: 'Cidade Teste' } });
  assert.deepEqual([show.items.map((i) => [i.key, i.amount]), show.final, show.unresolved], [[['show', 1800]], false, ['sound_custom']], 'som de show é sob medida');
});

async function seedClosing(chat) {
  const [c] = await sql("insert into ai_conversations (workspace_id, provider_chat_id, contact_name, owner, ai_enabled, last_inbound_at, lead_data) values ($1, $2, 'Cliente Sintético', 'ai', true, now(), '{\"tipo_evento\":\"Casamento\",\"data_evento\":\"2096-03-01\"}') returning *", [WS, chat]);
  const [pc] = await sql("insert into precontracts (workspace_id, event_date, formation, agreed_amount, status, public_token, generated_link) values ($1, '2096-03-01', 'Trio', 2100, 'draft', $2, $3) returning *", [WS, `tok${chat}`, `https://app.example.test/contrato/tok${chat}`]);
  await sql('update ai_conversations set precontract_id = $1 where id = $2', [pc.id, c.id]);
  const { snapshotOf, approvalHashOf } = await import('../../lib/ai/commercial/supervision.mjs');
  const [cl] = await sql("insert into ai_closings (workspace_id, conversation_id, status, summary, summary_text, summary_hash, owner_version, precontract_id) values ($1, $2, 'awaiting_approval', '{}', 'Resumo sintético', 'h', 1, $3) returning id", [WS, c.id, pc.id]);
  const hash = await approvalHashOf(cl.id, snapshotOf(pc));
  await sql('update ai_closings set approval_hash = $1, prepared_snapshot = $2 where id = $3', [hash, JSON.stringify(snapshotOf(pc)), cl.id]);
  return { conv: c, pc, closingId: cl.id, hash };
}

test('contrato pela API: fila da Central, aprovação da versão, sem envio sem canal ativo, rejeição devolve para o responsável', async () => {
  const a = await seedClosing('15550007001');
  const q = await call('GET', '/api/ai/commercial/queues');
  const card = q.body.contracts.find((c) => c.closing_id === a.closingId);
  assert.deepEqual([card.whatsapp_url, card.inbox_url], ['https://wa.me/15550007001', `/inbox?c=${a.conv.id}`]);
  assert.equal((await call('POST', `/api/ai/closings/${a.closingId}`, { action: 'approve', approval_hash: 'outra-versao' })).body.code, 'version_changed');
  const ok = await call('POST', `/api/ai/closings/${a.closingId}`, { action: 'approve', approval_hash: a.hash });
  assert.deepEqual([ok.status, ok.body.status], [200, 'approved']);
  assert.equal(ok.body.send_status, 'pending', 'sem canal ativo nada é enviado (fica na fila)');
  const [out] = await sql("select idempotency_key, sender_type, content from ai_message_outbox where conversation_id = $1", [a.conv.id]);
  assert.equal(out.idempotency_key, `closing-link:${a.closingId}`);
  assert.match(out.content, /contrato\/tok15550007001/);
  assert.equal((await call('POST', `/api/ai/closings/${a.closingId}`, { action: 'approve', approval_hash: a.hash })).body.status, 'already_sent');
  assert.equal((await sql('select count(*)::int n from ai_message_outbox where conversation_id = $1', [a.conv.id]))[0].n, 1, 'idempotente');

  const b = await seedClosing('15550007002');
  assert.equal((await call('POST', `/api/ai/closings/${b.closingId}`, { action: 'reject', reason: 'ajustar valor' })).status, 200);
  const [conv] = await sql('select needs_human from ai_conversations where id = $1', [b.conv.id]);
  assert.equal(conv.needs_human, true);
});

test('lembretes de assinatura: agendados no envio e cancelados quando assinado', async () => {
  const c = await seedClosing('15550007003');
  await sql("update ai_workspace_settings set signature_reminders_enabled = true, signature_reminder_templates = '{lembrete_um,lembrete_dois,lembrete_tres}', ai_enabled = true, mode = 'auto' where workspace_id = $1", [WS]);
  const supabase = getSupabaseAdmin();
  const { approveAndQueueLink } = await import('../../lib/ai/commercial/supervision.mjs');
  const r = await approveAndQueueLink({ supabase, workspaceId: WS, closingId: c.closingId, approvalHash: c.hash, actor: '00000000-0000-4000-8000-0000000000e1' });
  const { data: settings } = await supabase.from('ai_workspace_settings').select('*').eq('workspace_id', WS).maybeSingle();
  await markLinkSent({ supabase, workspaceId: WS, outboxId: r.outboxId, settings });
  const fu = await sql("select step, status from ai_followups where conversation_id = $1 and kind = 'signature' order by step", [c.conv.id]);
  assert.deepEqual(fu.map((f) => f.status), ['scheduled', 'scheduled', 'scheduled']);
  await sql("insert into contracts (workspace_id, precontract_id, status, signed_at) values ($1, $2, 'signed', now())", [WS, c.pc.id]);
  await sql("update ai_followups set due_at = now() - interval '1 minute' where conversation_id = $1 and kind = 'signature' and step = 1", [c.conv.id]);
  await supabase.rpc('ai_claim_due_followups', { p_limit: 10 });
  const [step1] = await sql("select status, cancel_reason from ai_followups where conversation_id = $1 and kind = 'signature' and step = 1", [c.conv.id]);
  assert.deepEqual([step1.status, step1.cancel_reason], ['cancelled', 'signed']);
});

test('participante de outro número: pedido de vínculo sem dados privados; link só após verificação e assinatura', async () => {
  const owner = await seedClosing('15550007004');
  const [ev] = await sql("insert into events (workspace_id, client_name, event_date) values ($1, 'Contratante Sintético', '2096-03-01') returning id", [WS]);
  await sql('update precontracts set event_id = $1 where id = $2', [ev.id, owner.pc.id]);
  const [guest] = await sql("insert into ai_conversations (workspace_id, provider_chat_id, owner, ai_enabled) values ($1, '15550007005', 'ai', true) returning *", [WS]);
  const supabase = getSupabaseAdmin();
  const ctx = { supabase, workspaceId: WS, conversation: guest, effects: {}, settings: {} };
  const out = await executeTool('vincular_evento', { nome_contratante: 'Contratante', data: '2096-03-01', papel: 'noiva' }, ctx);
  assert.ok(!JSON.stringify(out).includes('Sintético'), 'não confirma dados do evento ao solicitante');
  assert.equal((await executeTool('obter_link_cliente', {}, { ...ctx, conversation: { ...guest } })).ok, false);
  const [appr] = await sql("select id from ai_approvals where conversation_id = $1 and kind = 'participant_link'", [guest.id]);
  assert.equal((await call('POST', `/api/ai/approvals/${appr.id}`, { decision: 'approved', permissions: ['repertoire', 'panel'] })).status, 200);
  const [part] = await sql('select status, precontract_id from ai_conversation_participants where conversation_id = $1', [guest.id]);
  assert.deepEqual([part.status, part.precontract_id], ['verified', owner.pc.id]);
  assert.equal((await executeTool('obter_link_cliente', {}, { ...ctx, conversation: { ...guest } })).ok, false, 'sem contrato assinado, sem link');
  await sql("insert into contracts (workspace_id, precontract_id, status, signed_at) values ($1, $2, 'signed', now())", [WS, owner.pc.id]);
  await sql("update precontracts set status = 'signed' where id = $1", [owner.pc.id]);
  const link = await executeTool('obter_link_cliente', {}, { ...ctx, conversation: { ...guest } });
  assert.match(link.link, /\/cliente\/tok15550007004$/);
});

test('bloqueio no banco: sem aprovador humano só envia com autonomia liberada e caso convencional; link automático sai como IA', async () => {
  const supabase = getSupabaseAdmin();
  const s = await seedClosing('15550007010');
  await sql("update ai_workspace_settings set autonomy_mode = 'supervised' where workspace_id = $1", [WS]);
  const rpc = (mode) => supabase.rpc('ai_approve_closing', { p_workspace_id: WS, p_closing_id: s.closingId, p_approval_hash: s.hash, p_actor: null, p_mode: mode, p_message: 'x' });
  assert.equal((await rpc('supervised')).data[0].status, 'approval_required', 'supervisionado nunca aprova sozinho');
  await sql("update ai_workspace_settings set autonomy_mode = 'autonomous' where workspace_id = $1", [WS]);
  assert.equal((await rpc('autonomous')).data[0].status, 'approval_required', 'caso não convencional exige aprovação');
  await sql('update ai_closings set conventional = true where id = $1', [s.closingId]);
  assert.equal((await rpc('assisted')).data[0].status, 'approval_required', 'modo informado precisa ser o liberado');
  assert.equal((await rpc('autonomous')).data[0].status, 'approved');
  const [out] = await sql('select sender_type, author_user_id from ai_message_outbox where idempotency_key = $1', [`closing-link:${s.closingId}`]);
  assert.deepEqual([out.sender_type, out.author_user_id], ['ai', null], 'envio automático respeita kill switch e travas da IA');
  await sql("update ai_workspace_settings set autonomy_mode = 'supervised' where workspace_id = $1", [WS]);
});

test('validade: link aprovado grava expires_at de 15 dias; pré-contratos antigos não são alterados', async () => {
  const supabase = getSupabaseAdmin();
  const [legacy] = await sql("insert into precontracts (workspace_id, event_date, formation, status, created_at) values ($1, '2096-03-01', 'Duo', 'link_generated', now() - interval '3 days') returning id", [WS]);
  const s = await seedClosing('15550007011');
  const { approveAndQueueLink } = await import('../../lib/ai/commercial/supervision.mjs');
  await approveAndQueueLink({ supabase, workspaceId: WS, closingId: s.closingId, approvalHash: s.hash, actor: '00000000-0000-4000-8000-0000000000e1' });
  const [pc] = await sql("select status, round(extract(epoch from (expires_at - now())) / 86400) as days from precontracts where id = $1", [s.pc.id]);
  assert.deepEqual([pc.status, Number(pc.days)], ['link_generated', 15]);
  const [old] = await sql('select expires_at from precontracts where id = $1', [legacy.id]);
  assert.equal(old.expires_at, null, 'registro antigo segue com a regra anterior (created_at + 7)');
});

test('tabelas: aprovações concorrentes gravam uma única regra oficial', async () => {
  await sql("insert into ai_pricing_proposals (workspace_id, source, category, item_key, label, amount) values ($1, 'concorrencia', 'ceremony', 'quarteto', 'Quarteto teste', 2000)", [WS]);
  const p = (await call('GET', '/api/ai/pricing-proposals')).body.proposals.find((x) => x.source === 'concorrencia');
  const results = await Promise.all([1, 2, 3].map(() => call('POST', `/api/ai/pricing-proposals/${p.id}`, { decision: 'approved', valid_from: '2030-01-01' })));
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal((await sql("select count(*)::int n from quote_price_rules where workspace_id = $1 and item_key = 'quarteto'", [WS]))[0].n, 1);
});

test('lembretes: idempotentes no reenvio/concorrência e reiniciados para um novo pré-contrato', async () => {
  const supabase = getSupabaseAdmin();
  await sql("update ai_workspace_settings set signature_reminders_enabled = true, signature_reminder_templates = '{l1,l2,l3}', ai_enabled = true, mode = 'auto' where workspace_id = $1", [WS]);
  const { data: settings } = await supabase.from('ai_workspace_settings').select('*').eq('workspace_id', WS).maybeSingle();
  const s = await seedClosing('15550007012');
  const { approveAndQueueLink } = await import('../../lib/ai/commercial/supervision.mjs');
  const r = await approveAndQueueLink({ supabase, workspaceId: WS, closingId: s.closingId, approvalHash: s.hash, actor: '00000000-0000-4000-8000-0000000000e1' });
  const marks = await Promise.all([1, 2, 3].map(() => markLinkSent({ supabase, workspaceId: WS, outboxId: r.outboxId, settings })));
  assert.equal(marks.filter(Boolean).length, 1, 'só uma transição para link_sent');
  assert.equal((await sql("select count(*)::int n from ai_followups where conversation_id = $1 and kind = 'signature'", [s.conv.id]))[0].n, 3);
  await sql("update ai_followups set due_at = now() - interval '1 minute' where conversation_id = $1 and kind = 'signature' and step = 1", [s.conv.id]);
  await Promise.all([1, 2].map(() => supabase.rpc('ai_claim_due_followups', { p_limit: 10 })));
  assert.equal((await sql("select count(*)::int n from ai_message_outbox where conversation_id = $1 and idempotency_key like 'followup:%'", [s.conv.id]))[0].n, 1, 'claim concorrente não duplica lembrete');
  // Mesmo pré-contrato: reagendar não altera nada; novo pré-contrato reinicia a sequência.
  await supabase.rpc('ai_schedule_signature_reminders', { p_workspace_id: WS, p_conversation_id: s.conv.id, p_precontract_id: s.pc.id, p_days: [2, 7, 12], p_templates: ['l1', 'l2', 'l3'] });
  assert.equal((await sql("select status from ai_followups where conversation_id = $1 and kind = 'signature' and step = 1", [s.conv.id]))[0].status, 'sent');
  const [pc2] = await sql("insert into precontracts (workspace_id, event_date, formation, status) values ($1, '2096-03-01', 'Duo', 'link_generated') returning id", [WS]);
  await supabase.rpc('ai_schedule_signature_reminders', { p_workspace_id: WS, p_conversation_id: s.conv.id, p_precontract_id: pc2.id, p_days: [2, 7, 12], p_templates: ['l1', 'l2', 'l3'] });
  const rows = await sql("select status, precontract_id from ai_followups where conversation_id = $1 and kind = 'signature' order by step", [s.conv.id]);
  assert.ok(rows.every((x) => x.status === 'scheduled' && x.precontract_id === pc2.id));
});

test('Central → Tabelas: prévia e nova vigência só pelo Owner, auditadas; tabela antiga do Eventos só leitura', async () => {
  await sql("insert into quote_price_rules (workspace_id, category, item_key, label, amount, valid_from) values ($1,'reception','trio_3h','Trio 3h',1234,'2090-01-01')", [WS]);
  const change = { category: 'reception', item_key: 'trio_3h', label: 'Trio 3h', amount: 1290, valid_from: '2091-02-01' };
  assert.equal((await call('POST', '/api/pricing/rules/preview', change, 'admin')).status, 403, 'Admin não altera tabela');
  const prev = await call('POST', '/api/pricing/rules/preview', change);
  assert.equal(prev.status, 200);
  assert.deepEqual(prev.body.plan.ops.map((o) => o.type), ['close', 'insert']);
  assert.ok(prev.body.expected_hash);
  assert.equal((await call('POST', '/api/pricing/rules', { ...change, reason: 'teste', expected_hash: prev.body.expected_hash })).status, 400, 'sem confirmação explícita');
  assert.equal((await call('POST', '/api/pricing/rules', { ...change, reason: 'teste', expected_hash: prev.body.expected_hash, confirm: true }, 'admin')).status, 403);
  const ok = await call('POST', '/api/pricing/rules', { ...change, reason: 'ajuste sintético', expected_hash: prev.body.expected_hash, confirm: true });
  assert.equal(ok.status, 200);
  const again = await call('POST', '/api/pricing/rules', { ...change, valid_from: '2091-03-01', reason: 'repetido', expected_hash: prev.body.expected_hash, confirm: true });
  assert.equal(again.status, 409, 'prévia antiga recusada');
  assert.equal(again.body.code, 'state_changed');
  const rows = await sql("select amount::int a, valid_from::text f, valid_until::text u from quote_price_rules where workspace_id=$1 and item_key='trio_3h' order by valid_from", [WS]);
  assert.deepEqual(rows, [{ a: 1234, f: '2090-01-01', u: '2091-01-31' }, { a: 1290, f: '2091-02-01', u: null }]);
  const list = await call('GET', '/api/pricing/rules', null, 'admin');
  assert.equal(list.body.is_owner, false);
  assert.ok(list.body.changes.some((c) => c.reason === 'ajuste sintético'));
  const put = await call('PUT', '/api/settings/pricing', { pricing: { reception_quarteto_3h: 9999 } });
  assert.equal(put.status, 423);
  const get = await call('GET', '/api/settings/pricing', null, 'admin');
  assert.ok(get.body.official_rules.every((r) => r.category !== 'musician_fee'), 'regras públicas sem custo interno');
});

test('custos padrão do financeiro: só pelo servidor e para perfis autorizados', async () => {
  assert.equal((await call('GET', '/api/settings/finance-costs', null, 'none')).status, 401);
  assert.equal((await call('GET', '/api/settings/finance-costs', null, 'viewer')).status, 403);
  assert.equal((await call('PUT', '/api/settings/finance-costs', { costs: { musician_unit_cost: 1 } }, 'viewer')).status, 403);
  assert.equal((await call('PUT', '/api/settings/finance-costs', { costs: { sound_default_cost: -5 } })).status, 400);
  const saved = await call('PUT', '/api/settings/finance-costs', { costs: { musician_unit_cost: 123, sound_default_cost: 45, notes: 'sintético' } });
  assert.equal(saved.status, 200);
  assert.equal(Number(saved.body.costs.musician_unit_cost), 123);
  const again = await call('PUT', '/api/settings/finance-costs', { costs: { sound_default_cost: 46 } });
  assert.equal(Number(again.body.costs.musician_unit_cost), 123, 'atualiza a mesma linha do workspace');
  const got = (await call('GET', '/api/settings/finance-costs')).body;
  assert.equal(Number(got.costs.sound_default_cost), 46);
  assert.ok(Array.isArray(got.sound_tech_rules), 'custo do técnico entregue só a perfis do financeiro');
  assert.equal((await sql('select count(*)::int n from finance_cost_defaults where workspace_id = $1', [WS]))[0].n, 1);
});

test('tabelas por faixa: faixas com localidades vinculadas e faixa personalizada criada pelo primeiro preço auditado', async () => {
  const list = (await call('GET', '/api/pricing/rules')).body;
  const metro = list.tiers.find((t) => t.slug === 'metro');
  assert.ok(list.tiers.some((t) => t.slug === 'base') && list.tiers.some((t) => t.slug === 'ate120'));
  assert.ok(metro.areas.some((a) => a.name === 'Cidade Metro'), 'faixa mostra as localidades vinculadas');
  const change = { category: 'ceremony', item_key: 'duo@litoral-teste', label: 'Cerimônia Duo — Litoral Teste', amount: 1234, valid_from: '2096-01-01' };
  const preview = (await call('POST', '/api/pricing/rules/preview', change)).body;
  assert.equal(preview.ok, true);
  const saved = await call('POST', '/api/pricing/rules', { ...change, reason: 'Faixa personalizada de teste', expected_hash: preview.expected_hash, confirm: true });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const after = (await call('GET', '/api/pricing/rules')).body;
  assert.ok(after.tiers.some((t) => t.slug === 'litoral-teste' && t.label === 'Litoral Teste'));
  assert.ok(after.changes.some((c) => c.item_key === 'duo@litoral-teste'), 'histórico auditado');
});
