// Memória permanente de espaços: migration real + rota da Central + Nara gravando/reutilizando. Dados sintéticos.
// Rodar: ./supabase/local/run-ai-inbox.sh
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from './panel/server.mjs';
import { panelPool as pool, getSupabaseAdmin } from './panel/supabase-admin.stub.mjs';
import { executeTool } from '../../lib/ai/agent/tools.mjs';

const WS = process.env.PANEL_WORKSPACE_ID;
const sql = async (q, p) => (await pool.query(q, p)).rows;
const call = async (method, path, body, auth = 'owner') => {
  const out = await handle(method, path, '', body ? JSON.stringify(body) : undefined, { 'content-type': 'application/json', 'x-test-auth': auth });
  return { status: out.status, body: JSON.parse(out.body || '{}') };
};
const ctx = (lead) => ({ supabase: getSupabaseAdmin(), workspaceId: WS, conversation: { id: null, lead_data: { data_evento: '2090-05-05', ...lead } }, effects: {} });
let areaBase; let areaVila;

test.before(async () => {
  await sql('delete from workspaces where id = $1', [WS]);
  await sql("insert into workspaces (id, key, name, slug) values ($1, 'ws-venues', 'Workspace Espaços Teste', 'ws-venues')", [WS]);
  await sql("insert into quote_price_rules (workspace_id, category, item_key, label, amount, valid_from) values ($1, 'ceremony', 'duo', 'Duo', 1000, '2090-01-01'), ($1, 'ceremony', 'duo@faixa-x', 'Duo', 1300, '2090-01-01')", [WS]);
  [{ id: areaBase }] = await sql("insert into ai_service_areas (workspace_id, name, status, match_terms, active) values ($1, 'Cidade Base Teste', 'served', '{cidade base teste}', true) returning id", [WS]);
  [{ id: areaVila }] = await sql("insert into ai_service_areas (workspace_id, name, status, match_terms, active, price_tier, travel_fee) values ($1, 'Vila Vizinha Teste', 'served', '{vila vizinha teste}', true, 'faixa-x', 111) returning id", [WS]);
});
test.after(async () => { await pool.end(); });

test('Central: só admin; verificação grava fonte, data e responsável; homônimos em cidades diferentes convivem', async () => {
  assert.equal((await call('GET', '/api/ai/venues', null, 'none')).status, 401);
  const a = await call('POST', '/api/ai/venues', { name: 'Espaço Duplicado Teste', city: 'Cidade Base Teste', aliases: 'Duplicado', area_id: areaBase, lat: '-12.1', lng: '-38.1', address: 'Rua Inventada, 1' });
  assert.equal(a.status, 200);
  assert.equal(a.body.venue.status, 'verified');
  assert.equal(a.body.venue.source, 'owner');
  assert.ok(a.body.venue.verified_at);
  assert.equal(a.body.venue.verified_by, '00000000-0000-4000-8000-0000000000e1');
  const b = await call('POST', '/api/ai/venues', { name: 'Espaço Duplicado Teste', city: 'Vila Vizinha Teste', area_id: areaVila });
  assert.equal(b.status, 200, 'homônimo em outra cidade é outro espaço');
  const dup = await call('POST', '/api/ai/venues', { name: 'espaco duplicado teste', city: 'Cidade Base Teste' });
  assert.equal(dup.status, 409, 'mesmo espaço/cidade/UF não duplica');
  assert.equal((await call('POST', '/api/ai/venues', { name: 'X', city: 'Y', area_id: '00000000-0000-4000-8000-00000000dead' })).status, 400, 'localidade de outro workspace');
  const list = await call('GET', '/api/ai/venues');
  assert.equal(list.body.venues.length, 2);
});

test('Nara: homônimo sem cidade pergunta; com cidade reutiliza a memória e cobra a faixa certa', async () => {
  const c1 = ctx({ local: 'Espaço Duplicado Teste' });
  const r1 = await executeTool('consultar_precos', {}, c1);
  assert.equal(r1.erro, 'cidade_necessaria');
  assert.match(c1.effects.regionPendingText, /Em qual cidade fica o Espaço Duplicado Teste\?/);
  const c2 = ctx({ local: 'Espaço Duplicado Teste', cidade: 'Vila Vizinha Teste' });
  await executeTool('consultar_precos', {}, c2);
  assert.match(c2.effects.quoteTableText, /Duo – R\$ 1\.300/, 'faixa da localidade vinculada');
  const c3 = ctx({ local: 'no Duplicado, Cidade Base Teste' });
  await executeTool('consultar_precos', {}, c3);
  assert.match(c3.effects.quoteTableText, /Duo – R\$ 1\.000/, 'apelido + cidade');
});

test('Nara: espaço novo informado com a cidade vira relato para conferência, sem duplicar; não classifica sozinho', async () => {
  for (let i = 0; i < 2; i += 1) await executeTool('consultar_precos', {}, ctx({ local: 'Chácara Nova Teste', cidade: 'Cidade Base Teste' }));
  const rows = await sql("select * from ai_venues where workspace_id = $1 and name_norm = 'chacara nova teste'", [WS]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'client_reported');
  assert.equal(rows[0].source, 'client_message');
  assert.equal(rows[0].mentions, 2);
  assert.equal(rows[0].verified_at, null);
  assert.equal(rows[0].area_id, areaBase);
  const c = ctx({ local: 'Chácara Nova Teste' });
  assert.equal((await executeTool('consultar_precos', {}, c)).erro, 'cidade_necessaria', 'relato não verificado não decide sozinho');
  // Owner confere: a partir daí, a Nara reutiliza sem perguntar.
  const v = (await call('GET', '/api/ai/venues')).body.venues.find((x) => x.name_norm === 'chacara nova teste');
  assert.equal((await call('POST', '/api/ai/venues', { ...v, status: 'verified' })).status, 200);
  const after = ctx({ local: 'Chácara Nova Teste' });
  await executeTool('consultar_precos', {}, after);
  assert.match(after.effects.quoteTableText, /Duo – R\$ 1\.000/);
});

test('rejeitado não é reutilizado nem recriado como relato duplicado', async () => {
  const v = (await call('GET', '/api/ai/venues')).body.venues.find((x) => x.name_norm === 'chacara nova teste');
  await call('POST', '/api/ai/venues', { ...v, status: 'rejected' });
  const c = ctx({ local: 'Chácara Nova Teste' });
  assert.equal((await executeTool('consultar_precos', {}, c)).erro, 'cidade_necessaria');
  assert.equal((await sql("select count(*)::int n from ai_venues where workspace_id = $1 and name_norm = 'chacara nova teste'", [WS]))[0].n, 1);
});
