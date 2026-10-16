// Client Zero em Postgres LOCAL descartável com o schema real de produção (sem dados).
// Executa o código real do app (bootstrap de workspace, plano efetivo/limites, webhook Asaas no
// formato do sandbox) e prova isolamento A×B com RLS real (roles authenticated/anon).
// Nenhuma chamada externa: nada de Asaas, WhatsApp, e-mail ou produção.
//
// Rodar: ver supabase/local/README.md (LOCAL_DB_URL + PG_MODULE).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPgSupabase } from './pg-supabase.mjs';

const DB_URL = process.env.LOCAL_DB_URL || 'postgresql://postgres@localhost/harmonics_local?host=/tmp&port=54329';
if (!/host=\/tmp|@localhost|@127\.0\.0\.1/.test(DB_URL)) {
  throw new Error('client-zero.local: recusado — LOCAL_DB_URL precisa apontar para um Postgres local.');
}
const pg = (await import(process.env.PG_MODULE || 'pg')).default;
const pool = new pg.Pool({ connectionString: DB_URL, max: 8 });

process.env.ENFORCE_WORKSPACE_PLANS = 'true';
const { bootstrapWorkspaceForUser } = await import('../../lib/workspaces/bootstrap-workspace.js');
const { checkWorkspaceFeature, checkWorkspaceLimit, getWorkspacePlan } = await import('../../lib/billing/check-workspace-plan-limit.js');
const { processAsaasWebhook } = await import('../../lib/billing/process-asaas-webhook.js');

const service = createPgSupabase({ pool, role: 'service_role' });
const asUser = (sub) => createPgSupabase({ pool, role: 'authenticated', sub });
const anon = createPgSupabase({ pool, role: 'anon' });

async function resetDatabase() {
  const { rows } = await pool.query(
    "select string_agg(format('public.%I', tablename), ', ') t from pg_tables where schemaname='public' and tablename <> 'workspace_plans'"
  );
  await pool.query(`truncate ${rows[0].t}, auth.users cascade`);
}

async function signup(email) {
  const { rows } = await pool.query('insert into auth.users (email) values ($1) returning id', [email]);
  return rows[0].id;
}

async function seedTenant(workspaceId, tag) {
  const q = (sql, params) => pool.query(sql, params).then((r) => r.rows[0]);
  const contact = await q("insert into contacts (workspace_id, name, email, phone) values ($1, $2, $3, '71999990000') returning id", [workspaceId, `Músico ${tag}`, `musico.${tag}@example.test`]);
  const event = await q("insert into events (workspace_id, client_name, event_date) values ($1, $2, current_date + 30) returning id", [workspaceId, `Evento ${tag}`]);
  const pre = await q("insert into precontracts (workspace_id, client_name, event_id, public_token) values ($1, $2, $3, $4) returning id", [workspaceId, `Cliente ${tag}`, event.id, `tok-${tag}-${Date.now()}`]);
  const contract = await q("insert into contracts (workspace_id, event_id, precontract_id, client_name) values ($1, $2, $3, $4) returning id", [workspaceId, event.id, pre.id, `Cliente ${tag}`]);
  const payment = await q("insert into payments (workspace_id, event_id, amount, proof_file_url) values ($1, $2, 100, 'payment-proofs/x.pdf') returning id", [workspaceId, event.id]);
  const channel = await q("insert into whatsapp_channels (workspace_id, name, provider, api_key) values ($1, 'canal', 'wasender', 'segredo-do-canal') returning id", [workspaceId]);
  const rule = await q("insert into automation_rules (workspace_id, key, name, event_type, recipient_type) values ($1, 'r', 'r', 'invite_member', 'member') returning id", [workspaceId]);
  const invite = await q("insert into invites (event_id, contact_id) values ($1, $2) returning id", [event.id, contact.id]);
  const template = await q("insert into contract_templates (workspace_id, name, slug, content) values ($1, 'Modelo', $2, 'texto') returning id", [workspaceId, `modelo-${tag}`]);
  const eventType = await q("insert into event_types (workspace_id, name, slug) values ($1, 'Casamento', $2) returning id", [workspaceId, `casamento-${tag}`]);
  const pricing = await q("insert into pricing_settings (workspace_id, slug) values ($1, $2) returning id", [workspaceId, `pricing-${tag}`]);
  const scale = await q("insert into scale_templates (workspace_id, name, formation) values ($1, $2, 'trio') returning id", [workspaceId, `Escala ${tag}`]);
  return { contact, event, pre, contract, payment, channel, rule, invite, template, eventType, pricing, scale };
}

const state = {};

test.before(async () => {
  await resetDatabase();
});

test.after(async () => {
  await pool.end();
});

test('Client Zero: cadastro cria perfil comum (sem admin global)', async () => {
  state.userA = await signup('cliente.zero@example.test');
  state.userB = await signup('cliente.b@example.test');
  const { rows } = await pool.query('select role from profiles where id = $1', [state.userA]);
  assert.equal(rows[0].role, 'member');
});

test('Client Zero: bootstrap cria workspace Free próprio, owner, settings e assinatura Free', async () => {
  const result = await bootstrapWorkspaceForUser({ supabase: service, userId: state.userA, workspaceName: 'Banda Cliente Zero' });
  assert.equal(result.ok, true);
  state.wsA = result.workspace.id;
  assert.equal(result.workspace.plan_key, 'free', 'nunca o plano interno da Harmonics');
  assert.equal(result.workspace.owner_user_id, state.userA);
  assert.equal(result.ownerMembership.role, 'owner');
  assert.equal(result.ownerMembership.status, 'active');
  assert.ok(result.settings?.id, 'workspace_settings criado');
  assert.doesNotMatch(JSON.stringify(result.settings), /Harmonics/i, 'sem branding da Banda Harmonics');
  assert.equal(result.subscription?.plan?.slug, 'free');
  assert.equal(result.subscription?.status, 'active');

  const b = await bootstrapWorkspaceForUser({ supabase: service, userId: state.userB, workspaceName: 'Banda B' });
  state.wsB = b.workspace.id;
  assert.notEqual(state.wsA, state.wsB);
});

test('Client Zero: bootstrap é idempotente (retry e duplo clique concorrente)', async () => {
  const again = await bootstrapWorkspaceForUser({ supabase: service, userId: state.userA, workspaceName: 'Outro nome' });
  assert.equal(again.workspace.id, state.wsA);

  const userC = await signup('cliente.c@example.test');
  const results = await Promise.allSettled(
    Array.from({ length: 3 }, () => bootstrapWorkspaceForUser({ supabase: service, userId: userC, workspaceName: 'Banda C' }))
  );
  const ids = results.filter((r) => r.status === 'fulfilled').map((r) => r.value.workspace.id);
  assert.ok(ids.length >= 1);
  assert.equal(new Set(ids).size, 1, 'um único workspace');
  const { rows } = await pool.query('select count(*)::int n from workspaces where owner_user_id = $1', [userC]);
  assert.equal(rows[0].n, 1);
  const subs = await pool.query("select count(*)::int n from workspace_subscriptions s join workspaces w on w.id = s.workspace_id where w.owner_user_id = $1", [userC]);
  assert.equal(subs.rows[0].n, 1, 'uma única assinatura Free');
});

test('Plano Free: limites e recursos vêm do banco (servidor), não da UI', async () => {
  const plan = await getWorkspacePlan({ supabase: service, workspaceId: state.wsA });
  assert.equal(plan.ok, true);
  assert.equal(plan.plan?.slug, 'free');
  const automation = await checkWorkspaceFeature({ supabase: service, workspaceId: state.wsA, feature: 'automation' });
  assert.equal(automation.allowed, false, 'Free não usa automação');
  const whatsapp = await checkWorkspaceFeature({ supabase: service, workspaceId: state.wsA, feature: 'whatsapp' });
  assert.equal(whatsapp.allowed, false, 'Free não usa WhatsApp');
  const members = await checkWorkspaceLimit({ supabase: service, workspaceId: state.wsA, limitKey: 'members', increment: 1 });
  assert.equal(members.allowed, true, '1 membro de 2');
  await pool.query("insert into auth.users (email) values ('m2@example.test')");
  await pool.query("insert into workspace_members (workspace_id, user_id, role) select $1, id, 'viewer' from auth.users where email = 'm2@example.test'", [state.wsA]);
  const full = await checkWorkspaceLimit({ supabase: service, workspaceId: state.wsA, limitKey: 'members', increment: 1 });
  assert.equal(full.allowed, false, 'terceiro membro bloqueado no Free');
});

test('Asaas (formato sandbox): checkout pago ativa Starter; duplicata, fora de ordem e outro workspace não alteram', async () => {
  const starter = (await pool.query("select id from workspace_plans where slug='starter'")).rows[0].id;
  // O que /api/billing/subscribe grava depois de criar a assinatura no Asaas.
  await pool.query(
    "update workspace_subscriptions set metadata = metadata || jsonb_build_object('pending_checkout', jsonb_build_object('plan_id', $2::text, 'provider_subscription_id', 'sub_sandbox_A', 'provider_customer_id', 'cus_sandbox_A')) where workspace_id = $1",
    [state.wsA, starter]
  );
  const paid = {
    id: 'evt_sandbox_1', event: 'PAYMENT_CONFIRMED', dateCreated: '2026-10-16 10:00:00',
    payment: { id: 'pay_1', subscription: 'sub_sandbox_A', externalReference: state.wsA, value: 97, dueDate: '2026-10-16', paymentDate: '2026-10-16' },
  };
  const first = await processAsaasWebhook({ supabase: service, payload: paid });
  assert.equal(first.httpStatus, 200);
  let sub = (await pool.query('select s.*, p.slug from workspace_subscriptions s join workspace_plans p on p.id = s.plan_id where s.workspace_id = $1', [state.wsA])).rows[0];
  assert.equal(sub.slug, 'starter');
  assert.equal(sub.status, 'active');
  assert.equal(sub.provider_subscription_id, 'sub_sandbox_A');
  assert.equal(sub.metadata.pending_checkout, undefined);

  const dup = await processAsaasWebhook({ supabase: service, payload: paid });
  assert.equal(dup.body.duplicate, true);

  const stale = await processAsaasWebhook({ supabase: service, payload: { ...paid, id: 'evt_sandbox_0', event: 'PAYMENT_OVERDUE', dateCreated: '2026-10-15 10:00:00' } });
  assert.equal(stale.body.ignored, 'out_of_order');

  // Evento de outro workspace (externalReference de B, assinatura de A): não muda A nem B.
  const foreign = await processAsaasWebhook({ supabase: service, payload: { ...paid, id: 'evt_sandbox_x', payment: { ...paid.payment, subscription: 'sub_de_outro', externalReference: state.wsB } } });
  assert.equal(foreign.httpStatus, 200);
  const subB = (await pool.query('select p.slug from workspace_subscriptions s join workspace_plans p on p.id = s.plan_id where s.workspace_id = $1', [state.wsB])).rows[0];
  assert.equal(subB.slug, 'free');

  const overdue = await processAsaasWebhook({ supabase: service, payload: { ...paid, id: 'evt_sandbox_2', event: 'PAYMENT_OVERDUE', dateCreated: '2026-11-20 10:00:00' } });
  assert.equal(overdue.httpStatus, 200);
  sub = (await pool.query('select status from workspace_subscriptions where workspace_id = $1', [state.wsA])).rows[0];
  assert.equal(sub.status, 'past_due');
  const plan = await getWorkspacePlan({ supabase: service, workspaceId: state.wsA });
  assert.ok(plan.ok);
});

test('Isolamento A×B (RLS real, cliente A autenticado com a chave pública)', async () => {
  state.dataA = await seedTenant(state.wsA, 'a');
  state.dataB = await seedTenant(state.wsB, 'b');
  const a = asUser(state.userA);
  const tenantTables = ['events', 'contacts', 'precontracts', 'contracts', 'payments', 'whatsapp_channels', 'automation_rules', 'invites', 'workspace_members', 'workspaces', 'workspace_settings', 'workspace_subscriptions', 'billing_events', 'automation_logs', 'message_templates'];
  for (const table of tenantTables) {
    const { data, error } = await a.from(table).select('*');
    const rows = data || [];
    const leaked = rows.filter((row) => (row.workspace_id || row.id) === state.wsB || JSON.stringify(row).includes(state.wsB));
    assert.equal(leaked.length, 0, `${table}: A leu dados de B${error ? ` (${error.message})` : ''}`);
  }
  // Escrita cruzada.
  const upd = await a.from('events').update({ client_name: 'hack' }).eq('id', state.dataB.event.id);
  assert.equal((upd.data || []).length, 0, 'A não altera evento de B');
  const ins = await a.from('events').insert({ workspace_id: state.wsB, client_name: 'intruso' });
  assert.ok(ins.error, 'A não cria evento no workspace de B');
  const join = await a.from('workspace_members').insert({ workspace_id: state.wsB, user_id: state.userA, role: 'owner' });
  assert.ok(ins.error && join.error, 'A não se adiciona a B');
  const subUpd = await a.from('workspace_subscriptions').update({ status: 'active' }).eq('workspace_id', state.wsB);
  assert.equal((subUpd.data || []).length, 0, 'A não altera assinatura de B');
  const elevate = await a.from('profiles').update({ role: 'admin' }).eq('id', state.userA);
  assert.ok(elevate.error, 'A não se torna admin global');
});

test('Visitante anônimo (chave pública) não lê dados de clientes; só o catálogo de planos', async () => {
  for (const table of ['events', 'contacts', 'precontracts', 'contracts', 'payments', 'whatsapp_channels', 'workspaces', 'workspace_members', 'profiles']) {
    const { data } = await anon.from(table).select('*');
    assert.equal((data || []).length, 0, `anon leu ${table}`);
  }
  const plans = await anon.from('workspace_plans').select('*');
  assert.equal(plans.data.length, 5);
});

test('Configuração por workspace: A não lê tipos de evento, preços nem templates de escala de B', async () => {
  const a = asUser(state.userA);
  await pool.query('insert into scale_template_items (template_id, contact_id) values ($1, $2)', [state.dataB.scale.id, state.dataB.contact.id]);
  for (const table of ['event_types', 'pricing_settings', 'scale_templates', 'scale_template_items']) {
    const { data, error } = await a.from(table).select('*');
    assert.equal(error, null, `${table}: ${error?.message}`);
    const leaked = (data || []).filter((row) => JSON.stringify(row).includes(state.wsB) || row.template_id === state.dataB.scale.id);
    assert.equal(leaked.length, 0, `${table}: A leu configuração de B`);
  }
  const own = await a.from('scale_templates').select('*');
  assert.deepEqual(own.data.map((row) => row.id), [state.dataA.scale.id], 'A vê o próprio template');
});

test('Templates de escala pelo browser: owner de cliente novo cria/edita os próprios, nunca os de B', async () => {
  const a = asUser(state.userA);
  const created = await a.from('scale_templates').insert({ workspace_id: state.wsA, name: 'Trio A', formation: 'trio' }).select('*').single();
  assert.equal(created.error, null, created.error?.message);
  const item = await a.from('scale_template_items').insert({ template_id: created.data.id, contact_id: state.dataA.contact.id });
  assert.equal(item.error, null, item.error?.message);
  const del = await a.from('scale_template_items').delete().eq('template_id', created.data.id);
  assert.equal(del.data.length, 1);

  assert.ok((await a.from('scale_templates').insert({ workspace_id: state.wsB, name: 'x', formation: 'trio' })).error, 'cria em B');
  assert.ok((await a.from('scale_template_items').insert({ template_id: state.dataB.scale.id, contact_id: state.dataA.contact.id })).error, 'item em template de B');
  assert.ok((await a.from('scale_template_items').insert({ template_id: created.data.id, contact_id: state.dataB.contact.id })).error, 'contato de B no template de A');
  const upd = await a.from('scale_templates').update({ name: 'hack' }).eq('id', state.dataB.scale.id);
  assert.equal(upd.data.length, 0);
  const delB = await a.from('scale_template_items').delete().eq('template_id', state.dataB.scale.id);
  assert.equal(delB.data.length, 0);
});
