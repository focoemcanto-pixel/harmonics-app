// Governança das tabelas oficiais de preço em Postgres LOCAL descartável (dados 100% sintéticos):
// nova vigência atômica e auditada, detecção de alteração concorrente, início repetido recusado,
// regra futura preservada e escrita bloqueada para clientes (authenticated/anon).
import test from 'node:test';
import assert from 'node:assert/strict';

const DB_URL = process.env.LOCAL_DB_URL || 'postgresql://postgres@localhost/harmonics_local?host=/tmp&port=54329';
const parsed = new URL(DB_URL);
if (decodeURIComponent(parsed.pathname.slice(1)) !== 'harmonics_local') throw new Error('price-rules.local: use somente o banco descartável harmonics_local.');
const pg = (await import(process.env.PG_MODULE || 'pg')).default;
const pool = new pg.Pool({ connectionString: DB_URL, max: 5 });
const q = async (sql, params) => (await pool.query(sql, params)).rows;
const WS = '00000000-0000-4000-8000-0000000000e1';
const OWNER = '00000000-0000-4000-8000-0000000000e2';
const MEMBER = '00000000-0000-4000-8000-0000000000e3';

test.before(async () => {
  await q("insert into workspaces (id, key, name, slug) values ($1,'regras-teste','Regras Teste','regras-teste') on conflict do nothing", [WS]);
  await q('delete from quote_price_rule_changes where workspace_id = $1', [WS]);
  await q('delete from quote_price_rules where workspace_id = $1', [WS]);
  await q(`insert into quote_price_rules (workspace_id, category, item_key, label, amount, valid_from, valid_until) values
    ($1,'sound','church','Som A',611,'2090-01-01',null), ($1,'sound','church','Som futuro',733,'2092-01-01',null),
    ($1,'musician_fee','sound_tech','Técnico',211,'2090-01-01',null)`, [WS]);
});
test.after(async () => { await pool.end(); });

const hash = async (c, k) => (await q('select public.price_rules_state_hash($1,$2,$3) h', [WS, c, k]))[0].h;
const apply = (args) => q('select * from public.apply_price_rule_change($1,$2,$3,$4,$5,$6,$7,$8,$9)', args);

test('nova vigência: encerra a vigente na véspera, preserva a futura e audita', async () => {
  const h = await hash('sound', 'church');
  const [r] = await apply([WS, OWNER, 'sound', 'church', 'Som B', 655, '2091-03-10', 'ajuste sintético', h]);
  assert.equal(r.new_valid_until.toISOString().slice(0, 10), '2091-12-31');
  const rows = await q("select amount::int a, valid_from::text f, valid_until::text u from quote_price_rules where workspace_id=$1 and item_key='church' order by valid_from", [WS]);
  assert.deepEqual(rows, [{ a: 611, f: '2090-01-01', u: '2091-03-09' }, { a: 655, f: '2091-03-10', u: '2091-12-31' }, { a: 733, f: '2092-01-01', u: null }]);
  const [audit] = await q('select actor, reason, closed_rule->>\'amount\' closed, new_rule->>\'amount\' novo, next_rule is not null tem_futura from quote_price_rule_changes where workspace_id=$1', [WS]);
  assert.deepEqual(audit, { actor: OWNER, reason: 'ajuste sintético', closed: '611.00', novo: '655.00', tem_futura: true });
});

test('alteração concorrente, início repetido e motivo ausente são recusados sem gravar', async () => {
  const before = (await q('select count(*)::int n from quote_price_rules where workspace_id=$1', [WS]))[0].n;
  await assert.rejects(apply([WS, OWNER, 'sound', 'church', 'x', 1, '2091-06-01', 'motivo', 'hash-antigo']), /state_changed/);
  await assert.rejects(apply([WS, OWNER, 'sound', 'church', 'x', 1, '2091-03-10', 'motivo', await hash('sound', 'church')]), /rule_exists_same_start/);
  await assert.rejects(apply([WS, OWNER, 'sound', 'church', 'x', 1, '2091-07-01', '', await hash('sound', 'church')]), /reason_required/);
  await assert.rejects(apply([WS, null, 'sound', 'church', 'x', 1, '2091-07-01', 'motivo', await hash('sound', 'church')]), /actor_required/);
  assert.equal((await q('select count(*)::int n from quote_price_rules where workspace_id=$1', [WS]))[0].n, before);
  assert.equal((await q('select count(*)::int n from quote_price_rule_changes where workspace_id=$1', [WS]))[0].n, 1);
});

test('duas confirmações simultâneas da mesma prévia: só uma grava', async () => {
  const h = await hash('sound', 'church');
  const results = await Promise.allSettled([1, 2, 3].map(() => apply([WS, OWNER, 'sound', 'church', 'Som C', 699, '2091-09-01', 'concorrência sintética', h])));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await q("select count(*)::int n from quote_price_rules where workspace_id=$1 and valid_from='2091-09-01'", [WS]))[0].n, 1);
});

test('navegador não grava regras nem lê custo interno sem ser Owner/Admin', async () => {
  await q("insert into auth.users (id, email) values ($1, 'membro@exemplo.test'), ($2, 'owner@exemplo.test') on conflict do nothing", [MEMBER, OWNER]);
  await q("insert into workspace_members (workspace_id, user_id, role, status) values ($1,$2,'viewer','active'), ($1,$3,'owner','active') on conflict (workspace_id, user_id) do update set role = excluded.role, status = 'active'", [WS, MEMBER, OWNER]);
  const asUser = async (uid, sql, params) => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
      await client.query('set local role authenticated');
      return (await client.query(sql, params)).rows;
    } finally { await client.query('rollback').catch(() => {}); client.release(); }
  };
  await assert.rejects(asUser(MEMBER, "insert into quote_price_rules (workspace_id, category, item_key, label, amount, valid_from) values ($1,'sound','x','x',1,'2090-01-01')", [WS]), /permission denied|row-level security/);
  await assert.rejects(asUser(OWNER, "update quote_price_rules set amount = 1 where workspace_id = $1", [WS]), /permission denied/);
  await assert.rejects(asUser(MEMBER, 'select * from quote_price_rule_changes'), /permission denied/);
  await assert.rejects(asUser(MEMBER, "select public.apply_price_rule_change($1,$2,'sound','church','x',1,'2093-01-01','x','x')", [WS, MEMBER]), /permission denied/);
  const memberSees = await asUser(MEMBER, 'select category from quote_price_rules where workspace_id = $1', [WS]);
  const ownerSees = await asUser(OWNER, 'select category from quote_price_rules where workspace_id = $1', [WS]);
  assert.ok(memberSees.length > 0, 'membro lê preços de venda');
  assert.equal(memberSees.some((r) => r.category === 'musician_fee'), false, 'membro comum não vê custo interno');
  assert.equal(ownerSees.some((r) => r.category === 'musician_fee'), true, 'Owner vê custo interno');
});

test('orçamentos: navegador sem escrita; leitura só para Owner/Admin/Financeiro', async () => {
  await q("insert into quotes (workspace_id, status) values ($1, 'draft')", [WS]).catch(async () => q("insert into quotes (workspace_id) values ($1)", [WS]));
  const asUser = async (uid, sql, params) => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
      await client.query('set local role authenticated');
      return (await client.query(sql, params)).rows;
    } finally { await client.query('rollback').catch(() => {}); client.release(); }
  };
  assert.equal((await asUser(MEMBER, 'select id from quotes where workspace_id = $1', [WS])).length, 0, 'membro comum não lê orçamentos (custos)');
  assert.ok((await asUser(OWNER, 'select id from quotes where workspace_id = $1', [WS])).length > 0, 'Owner lê');
  await assert.rejects(asUser(OWNER, 'delete from quotes where workspace_id = $1', [WS]), /permission denied/);
});
