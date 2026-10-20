import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePrecontractHtmlSource, renderContractHtmlWithTemplateData } from '../lib/contracts/resolveContractHtmlSource.js';

const template = { id: 'template', workspace_id: 'w1', source_rich_html: '<p>Cláusula original {{client_name}}</p>' };
const pre = { id: 'a', workspace_id: 'w1', contract_template_id: template.id, custom_contract_enabled: true };
function database() {
  const reads = [];
  return { reads, from(table) {
    const filters = {};
    return { select() { return this; }, eq(k, v) { filters[k] = v; return this; },
      async maybeSingle() {
        reads.push({ table, filters });
        return { data: table === 'contract_templates' && filters.id === template.id && filters.workspace_id === template.workspace_id ? { ...template } : null };
      } };
  } };
}

test('same token: original → persisted customization → reload/reopen; template and sibling isolated', async () => {
  const supabase = database();
  const rows = new Map([['same-public-token', structuredClone(pre)], ['other-public-token', { ...pre, id: 'b' }]]);
  const open = async (token) => resolvePrecontractHtmlSource({ supabase, precontract: structuredClone(rows.get(token)) });
  const originalTemplate = structuredClone(template);
  assert.match((await open('same-public-token')).html, /original/);
  rows.set('same-public-token', { ...rows.get('same-public-token'), custom_contract_rich_html: '<p>Cláusula personalizada {{client_name}}</p>' });
  assert.match((await open('same-public-token')).html, /personalizada/);
  assert.match((await open('same-public-token')).html, /personalizada/);
  const signedHtml = renderContractHtmlWithTemplateData((await open('same-public-token')).html, { client_name: 'Cliente fictício' });
  assert.equal(signedHtml, '<p>Cláusula personalizada Cliente fictício</p>');
  assert.match((await open('other-public-token')).html, /original/);
  assert.deepEqual(template, originalTemplate);
});

test('individual rich/text content beats linked template without querying or mutating it', async () => {
  for (const field of ['custom_contract_rich_html', 'custom_contract_content']) {
    const supabase = database();
    const row = { ...pre, [field]: '<p>Individual</p>' };
    const before = structuredClone(row);
    assert.equal((await resolvePrecontractHtmlSource({ supabase, precontract: row })).html, '<p>Individual</p>');
    assert.deepEqual(supabase.reads, []);
    assert.deepEqual(row, before);
  }
});

test('template fallback is scoped to workspace; empty customization restores default', async () => {
  const supabase = database();
  assert.match((await resolvePrecontractHtmlSource({ supabase, precontract: { ...pre, custom_contract_rich_html: '  ' } })).html, /original/);
  assert.equal((await resolvePrecontractHtmlSource({ supabase, precontract: { ...pre, workspace_id: 'w2' } })).html, '');
});

// Execute the actual API handler with a stateful database adapter. No production
// credentials, clients, notifications or external signature/PDF service are used.
import { readFileSync } from 'node:fs';
function loadHandler(path, deps, name) {
  let source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  source = source.replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm, '');
  source = source.replace(/^export const (GET|POST) = .*;$/gm, '');
  return new Function(...Object.keys(deps), `${source}; return ${name};`)(...Object.values(deps));
}
const response = { json: (body, options) => Response.json(body, options) };
function statefulDb() {
  const rows = { precontracts: [{ ...pre, status: 'link_generated', public_token: 'same-public-token' }, { ...pre, id: 'b', public_token: 'other-public-token' }],
    contract_templates: [structuredClone(template)], contracts: [] };
  const writes = [];
  return { rows, writes, from(table) {
    let update;
    const filters = [];
    const matches = (row) => filters.every(([key, value, invert]) => invert ? row[key] !== value : String(row[key]) === String(value));
    const execute = () => {
      let data = (rows[table] || []).find(matches) || null;
      if (data && update) { writes.push({ table, id: data.id }); Object.assign(data, update); }
      return { data: data ? structuredClone(data) : null, error: null };
    };
    return { select() { return this; }, update(value) { update = value; return this; },
      eq(k, v) { filters.push([k, v, false]); return this; }, neq(k,v) { filters.push([k,v,true]); return this; },
      maybeSingle: async () => execute(), single: async () => execute() };
  } };
}

test('actual save API persists only the customization, preserves token and finances, rejects cross-workspace and signed records', async () => {
  const supabase = statefulDb();
  const save = loadHandler('app/api/precontracts/route.js', {
    NextResponse: response, getSupabaseAdmin: () => supabase,
    requireWorkspaceAdmin: async () => ({ ok: true, workspaceId: 'w1' }),
  }, 'handlePOST');
  const request = (id, html, more = {}) => new Request('https://test/api/precontracts', { method: 'POST', body: JSON.stringify({ id,
    action: 'customize_contract', payload: { custom_contract_rich_html: html, agreed_amount: 9999, public_token: 'changed' }, ...more }) });
  const beforeTemplate = structuredClone(supabase.rows.contract_templates);
  const beforeSibling = structuredClone(supabase.rows.precontracts[1]);
  const result = await save(request('a', '<p>Alteração persistida {{client_name}}</p>'));
  assert.equal(result.status, 200);
  assert.equal(supabase.rows.precontracts[0].custom_contract_rich_html, '<p>Alteração persistida {{client_name}}</p>');
  assert.equal(supabase.rows.precontracts[0].public_token, 'same-public-token');
  assert.equal(supabase.rows.precontracts[0].agreed_amount, undefined);
  assert.deepEqual(supabase.rows.contract_templates, beforeTemplate);
  assert.deepEqual(supabase.rows.precontracts[1], beforeSibling);
  assert.deepEqual(supabase.writes, [{ table: 'precontracts', id: 'a' }]);
  supabase.rows.precontracts[0].workspace_id = 'w2';
  assert.equal((await save(request('a', '<p>Denied</p>'))).status, 404);
  supabase.rows.precontracts[0].workspace_id = 'w1';
  supabase.rows.contracts.push({ precontract_id: 'a', signed_at: '2026-10-20' });
  assert.equal((await save(request('a', '<p>Denied</p>'))).status, 409);
  supabase.rows.contracts = [];
  assert.equal((await save(request('a', '', { restore_default: true }))).status, 200);
  assert.match((await resolvePrecontractHtmlSource({ supabase, precontract: supabase.rows.precontracts[0] })).html, /original/);
});

test('actual public GET reads fresh customization on the SAME token after save and reopening', async () => {
  const supabase = statefulDb();
  const source = readFileSync(new URL('../app/api/public/contracts/[token]/route.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm, '').replace(/export /g, '');
  const get = new Function('NextResponse', 'getSupabaseAdmin', 'resolvePrecontractHtmlSource', 'expirePrecontractIfNeeded', 'isPrecontractExpiredStatus', `${source}; return GET;`)(response, () => supabase, resolvePrecontractHtmlSource, async ({ precontract }) => ({ precontract }), () => false);
  const open = async () => (await get(null, { params: Promise.resolve({ token: 'same-public-token' }) })).json();
  assert.match((await open()).precontract.contract_source_html, /original/);
  supabase.rows.precontracts[0].custom_contract_rich_html = '<p>Atualizado</p>';
  assert.match((await open()).precontract.contract_source_html, /Atualizado/);
  assert.match((await open()).precontract.contract_source_html, /Atualizado/);
});

test('signature generation and PDF regeneration use individual HTML; signed snapshot beats later edits', async () => {
  const supabase = statefulDb();
  const custom = '<p>Personalizado {{client_name}}</p>';
  supabase.rows.precontracts[0].custom_contract_rich_html = custom;
  // Generation also performs settings/workspace reads; the adapter intentionally
  // returns no explicit engine, exercising its internal-engine fallback.
  const deps = {
    resolvePrecontractHtmlSource,
    buildContractTemplateData: () => ({ client_name: 'Cliente QA' }),
    generateInternalContract: (context, data) => ({ html: renderContractHtmlWithTemplateData(context.precontract.custom_contract_rich_html, data) }),
  };
  let code = readFileSync(new URL('../lib/contracts/generate-contract-document.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm, '').replace(/export /g, '');
  const generate = new Function(...Object.keys(deps), `${code}; return generateContractDocument;`)(...Object.values(deps));
  const generated = await generate({ supabase, precontractId: 'a', previewOnly: true });
  assert.equal(generated.html, '<p>Personalizado Cliente QA</p>');
  assert.deepEqual(supabase.writes, [], 'generation must not write/copy global template into precontract');
  code = readFileSync(new URL('../app/api/public/contracts/[token]/regenerate-pdf/route.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm, '').replace(/export /g, '');
  const resolvePdf = new Function('resolvePrecontractHtmlSource', 'renderContractHtmlWithTemplateData', 'buildContractTemplateData', `${code}; return resolveRealContractHtml;`)(resolvePrecontractHtmlSource, renderContractHtmlWithTemplateData, deps.buildContractTemplateData);
  assert.equal((await resolvePdf({ supabase, precontract: supabase.rows.precontracts[0], contract: {} })).html, generated.html);
  const contract = { raw_payload: { signed_contract_html: generated.html } };
  supabase.rows.precontracts[0].custom_contract_rich_html = '<p>Later change</p>';
  assert.equal((await resolvePdf({ supabase, precontract: supabase.rows.precontracts[0], contract })).html, generated.html);
});
