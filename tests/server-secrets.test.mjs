// BE-9/BE-10: rotas de cron e chamadas internas falham fechadas, sem vazar o segredo.
// Supabase em memória e provider falso: nenhum job real é executado.
import { register } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemorySupabase } from './helpers/memory-supabase.mjs';

register('./helpers/automation-fakes-loader.mjs', import.meta.url);

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'service-role-test-key';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'anon-test-key';

const { verifyCronRequest, verifyInternalRequest, readBearerToken } = await import('../lib/api/server-secrets.js');
const { GET: automationCronGET } = await import('../app/api/automation/cron/route.js');
const { GET: paymentCronGET, POST: paymentCronPOST } = await import('../app/api/cron/payment-reminders/route.js');

const SECRET = 'cron-secret-de-teste-0123456789abcdef';
const WS = '0a0a0a0a-0000-4000-8000-00000000000a';

function setupDb() {
  const supabase = createMemorySupabase({
    tables: {
      workspaces: [{ id: WS, name: 'A', is_active: true }],
      automation_rules: [{ id: 'r1', workspace_id: WS, key: 'x', name: 'x', event_type: 'repertoire_pending_15_days_client', recipient_type: 'client', is_active: true, days_before: 15, send_time: '23:59' }],
      message_templates: [],
      automation_cron_runs: [],
    },
    unique: { automation_rules: [['workspace_id', 'key']], message_templates: [['workspace_id', 'key']] },
  });
  globalThis.__MEMORY_SUPABASE__ = supabase;
  globalThis.__WHATSAPP_SENT__ = [];
  return supabase;
}

function req(url, headers = {}) {
  return new Request(url, { headers });
}

async function withEnv(vars, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function captureConsole(fn) {
  const lines = [];
  const original = { info: console.info, error: console.error, warn: console.warn, log: console.log };
  for (const level of Object.keys(original)) {
    console[level] = (...args) => lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  }
  try {
    const result = await fn();
    return { result, output: lines.join('\n') };
  } finally {
    Object.assign(console, original);
  }
}

const CRON_ROUTES = [
  ['/api/automation/cron', automationCronGET],
  ['/api/cron/payment-reminders', paymentCronGET],
];

for (const [path, handler] of CRON_ROUTES) {
  test(`A: ${path} sem CRON_SECRET configurado → 503 e nada executa`, async () => {
    const supabase = setupDb();
    const { result: response } = await captureConsole(() =>
      withEnv({ CRON_SECRET: undefined }, () => handler(req(`https://app.test${path}`)))
    );
    assert.equal(response.status, 503);
    assert.equal(supabase.calls.length, 0, 'nenhuma consulta/execução');
    // Nem com um Bearer qualquer.
    const { result: withBearer } = await captureConsole(() =>
      withEnv({ CRON_SECRET: undefined }, () => handler(req(`https://app.test${path}`, { authorization: 'Bearer qualquer' })))
    );
    assert.equal(withBearer.status, 503);
    assert.equal(supabase.calls.length, 0);
  });

  test(`B/E/F: ${path} com segredo errado, em query string ou token de usuário → 401`, async () => {
    const supabase = setupDb();
    const attempts = [
      req(`https://app.test${path}`),
      req(`https://app.test${path}`, { authorization: 'Bearer errado' }),
      req(`https://app.test${path}`, { authorization: SECRET }), // sem o prefixo Bearer
      req(`https://app.test${path}?secret=${SECRET}`),
      req(`https://app.test${path}?key=${SECRET}`),
      req(`https://app.test${path}`, { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.usuario-logado.assinatura', cookie: 'sb-access-token=usuario' }),
      req(`https://app.test${path}`, { 'x-internal-key': SECRET }),
    ];
    for (const request of attempts) {
      const { result: response } = await captureConsole(() => withEnv({ CRON_SECRET: SECRET }, () => handler(request)));
      assert.equal(response.status, 401, request.url);
    }
    assert.equal(supabase.calls.length, 0);
  });

  test(`C/D: ${path} com Bearer correto executa; o segredo não aparece na resposta nem no log`, async () => {
    const supabase = setupDb();
    const { result: response, output } = await captureConsole(() =>
      withEnv({ CRON_SECRET: SECRET }, () => handler(req(`https://app.test${path}`, { authorization: `Bearer ${SECRET}` })))
    );
    assert.notEqual(response.status, 401);
    assert.notEqual(response.status, 503);
    assert.ok(supabase.calls.length > 0, 'a rotina executou');
    const body = await response.text();
    assert.equal(body.includes(SECRET), false, 'segredo na resposta');
    assert.equal(output.includes(SECRET), false, 'segredo no log');
  });
}

test('D: rejeição não vaza o segredo esperado nem o recebido', async () => {
  setupDb();
  const { result: response, output } = await captureConsole(() =>
    withEnv({ CRON_SECRET: SECRET }, () => automationCronGET(req('https://app.test/api/automation/cron', { authorization: 'Bearer tentativa-xyz' })))
  );
  const body = await response.text();
  for (const value of [SECRET, 'tentativa-xyz']) {
    assert.equal(body.includes(value), false);
    assert.equal(output.includes(value), false);
  }
});

test('POST /api/cron/payment-reminders: sem segredo e sem sessão de admin → 401', async () => {
  const supabase = setupDb();
  const { result: response } = await captureConsole(() =>
    withEnv({ CRON_SECRET: undefined }, () => paymentCronPOST(new Request('https://app.test/api/cron/payment-reminders', { method: 'POST', body: '{}' })))
  );
  assert.equal(response.status, 401);
  assert.equal(supabase.calls.filter((c) => c.table !== 'profiles').length, 0);
});

test('verifyCronRequest: só Bearer com o valor exato; ausente → 503', () => {
  const env = { CRON_SECRET: SECRET };
  assert.deepEqual(verifyCronRequest(req('https://x', { authorization: `Bearer ${SECRET}` }), { env }), { ok: true });
  assert.equal(verifyCronRequest(req('https://x', { authorization: `bearer ${SECRET}` }), { env }).ok, true);
  assert.equal(verifyCronRequest(req('https://x', { authorization: `Bearer ${SECRET}x` }), { env }).status, 401);
  assert.equal(verifyCronRequest(req('https://x', { authorization: `Bearer ${SECRET.slice(1)}` }), { env }).status, 401);
  assert.equal(verifyCronRequest(req('https://x', { authorization: `Bearer ${SECRET}` }), { env: {} }).status, 503);
  assert.equal(verifyCronRequest(req('https://x', { authorization: 'Bearer ' }), { env: { CRON_SECRET: '   ' } }).status, 503);
  assert.equal(readBearerToken(req('https://x', { authorization: 'Basic abc' })), '');
});

test('F: chamada interna exige a chave configurada; usuário logado ou chave vazia não bastam', () => {
  const key = 'internal-key-0123456789';
  // Sem nenhuma chave configurada: nada é interno, nem com header vazio/qualquer.
  assert.equal(verifyInternalRequest(req('https://x', { 'x-internal-key': '' }), { env: {} }), false);
  assert.equal(verifyInternalRequest(req('https://x', { 'x-internal-key': 'qualquer' }), { env: {} }), false);
  assert.equal(verifyInternalRequest(req('https://x', { authorization: 'Bearer token-de-usuario', cookie: 'sb=1' }), { env: { INTERNAL_API_KEY: key } }), false);
  // Padrão e legado, cada um só com a própria variável.
  assert.equal(verifyInternalRequest(req('https://x', { 'x-internal-key': key }), { env: { INTERNAL_API_KEY: key } }), true);
  assert.equal(verifyInternalRequest(req('https://x', { 'x-internal-api-secret': key }), { env: { INTERNAL_API_SECRET: key } }), true);
  assert.equal(verifyInternalRequest(req('https://x', { 'x-internal-api-secret': key }), { env: { INTERNAL_API_KEY: key } }), false);
  assert.equal(verifyInternalRequest(req('https://x', { 'x-internal-key': `${key}x` }), { env: { INTERNAL_API_KEY: key } }), false);
});
