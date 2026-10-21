import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
function handler(path, name, db, authName) {
  let source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm, '')
    .replace(/^export const .*$/gm, '').replace(/export async function/g, 'async function');
  return new Function('NextResponse', 'getSupabaseAdmin', authName, `${source}; return ${name}`)(
    { json: (body, options) => Response.json(body, options) }, () => db,
    async () => ({ ok: true, workspaceId: 'workspace-fixture' }));
}
function database(rows) {
  const reads = [];
  return { reads, from(table) {
    const filters = [];
    const q = { select() { return q }, eq(k,v) { filters.push(r => r[k] === v); return q },
      neq(k,v) { filters.push(r => r[k] !== v); return q }, in(k,v) { filters.push(r => v.includes(r[k])); return q },
      order() { return q }, limit() { return q }, then(resolve) {
        reads.push(table);
        return Promise.resolve({ data: structuredClone((rows[table] || []).filter(r => filters.every(f => f(r)))), error: null }).then(resolve);
      } };
    return q;
  } };
}
test('precontract list links only its signed contract in the current workspace', async () => {
  const db = database({ precontracts: [{id:'pre-a',workspace_id:'workspace-fixture'}, {id:'pre-b',workspace_id:'workspace-fixture'}],
    contracts: [{id:'other-tenant',workspace_id:'elsewhere',precontract_id:'pre-a',status:'signed'},
      {id:'signed-a',workspace_id:'workspace-fixture',precontract_id:'pre-a',status:'signed'},
      {id:'unsigned-b',workspace_id:'workspace-fixture',precontract_id:'pre-b',status:'draft'}] });
  const get = handler('app/api/precontracts/route.js','handleGET',db,'requireWorkspaceAdmin');
  const result = await (await get(new Request('https://fixture.test/api/precontracts'))).json();
  assert.equal(result.data[0].signed_contract_id,'signed-a');
  assert.equal(result.data[1].signed_contract_id,null);
  assert.equal(db.reads.filter(t => t === 'contracts').length,1);
});
test('external contract identification uses linked event without cross-workspace leakage', async () => {
  const db = database({ contracts:[{id:'c',event_id:'event-a',workspace_id:'workspace-fixture'}],
    events:[{id:'event-a',client_name:'Casal Exemplo QA',event_date:'2032-04-12',workspace_id:'workspace-fixture'},
      {id:'event-a',client_name:'Other tenant fixture',workspace_id:'elsewhere'}] });
  const get = handler('app/api/contracts/route.js','GET',db,'requireWorkspaceAccess');
  const result = await (await get(new Request('https://fixture.test/api/contracts'))).json();
  assert.equal(result.contracts[0].event.client_name,'Casal Exemplo QA');
  assert.equal(result.contracts[0].event.event_date,'2032-04-12');
});
