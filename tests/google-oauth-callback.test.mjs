import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
process.env.GOOGLE_OAUTH_STATE_SECRET = 'state-secret-test';
process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id-test.apps.googleusercontent.com';
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'client-secret-test';
process.env.GOOGLE_OAUTH_REDIRECT_URI = 'https://app.test/api/google/oauth/callback';

const { GET } = await import('../app/api/google/oauth/callback/route.js');
const { exchangeGoogleAuthorizationCode, parseTokenPayload } = await import(
  '../lib/google/oauth-token-exchange.js'
);

const USER_ID = '8d873ea8-0000-4000-8000-000000000001';
const GOOGLE_BODY = {
  access_token: 'ya29.access-test',
  expires_in: 3599,
  refresh_token: '1//refresh-test',
  scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents',
  token_type: 'Bearer',
};

function signedState(userId, issuedAt = Date.now()) {
  const payload = `${crypto.randomBytes(8).toString('hex')}.${Buffer.from(userId).toString('base64url')}.${issuedAt}`;
  const signature = crypto
    .createHmac('sha256', process.env.GOOGLE_OAUTH_STATE_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

// Resposta como a do bundle no Worker: corpo JSON correto, mas sem Content-Type utilizável.
function googleResponse(body, status = 200) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
}

function installFetch({ google }) {
  const calls = { google: [], upserts: [], selects: 0 };
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input?.url || input);
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      calls.google.push({ init, body: new URLSearchParams(String(init.body)) });
      return google();
    }
    if (url.startsWith('https://supabase.test/rest/v1/google_oauth_credentials')) {
      const method = String(init.method || input?.method || 'GET').toUpperCase();
      if (method === 'GET') {
        calls.selects += 1;
        return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
      }
      const raw = init.body ?? (input?.text ? await input.text() : '');
      calls.upserts.push(JSON.parse(String(raw)));
      return new Response('', { status: 201 });
    }
    throw new Error(`fetch inesperado: ${url}`);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function captureLogs() {
  const lines = [];
  const originals = { error: console.error, info: console.info, log: console.log, warn: console.warn };
  for (const k of Object.keys(originals)) {
    console[k] = (...args) => lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  }
  return { text: () => lines.join('\n'), restore: () => Object.assign(console, originals) };
}

test('parseTokenPayload aceita objeto (formato anterior) e string JSON (formato do Worker)', () => {
  assert.deepEqual(parseTokenPayload(GOOGLE_BODY), GOOGLE_BODY);
  assert.deepEqual(parseTokenPayload(JSON.stringify(GOOGLE_BODY)), GOOGLE_BODY);
  assert.equal(parseTokenPayload(''), null);
  assert.equal(parseTokenPayload('não é json'), null);
  assert.equal(parseTokenPayload('[1,2]'), null);
  assert.equal(parseTokenPayload(null), null);
});

test('troca do code interpreta o JSON sem depender do Content-Type e envia os parâmetros corretos', async () => {
  let sent;
  const payload = await exchangeGoogleAuthorizationCode({
    code: 'auth-code',
    clientId: 'cid',
    clientSecret: 'csecret',
    redirectUri: 'https://app.test/cb',
    fetchImpl: async (url, init) => {
      sent = { url, init, body: new URLSearchParams(init.body) };
      return googleResponse(GOOGLE_BODY);
    },
  });
  assert.equal(payload.access_token, GOOGLE_BODY.access_token);
  assert.equal(payload.refresh_token, GOOGLE_BODY.refresh_token);
  assert.equal(sent.url, 'https://oauth2.googleapis.com/token');
  assert.equal(sent.init.method, 'POST');
  assert.equal(sent.body.get('grant_type'), 'authorization_code');
  assert.equal(sent.body.get('code'), 'auth-code');
  assert.equal(sent.body.get('redirect_uri'), 'https://app.test/cb');
});

test('erro do Google vira mensagem sem code, secret ou tokens', async () => {
  await assert.rejects(
    exchangeGoogleAuthorizationCode({
      code: 'auth-code-secreto',
      clientId: 'cid',
      clientSecret: 'csecret-secreto',
      redirectUri: 'https://app.test/cb',
      fetchImpl: async () => googleResponse({ error: 'invalid_grant', error_description: 'Bad Request' }, 400),
    }),
    (error) => {
      assert.match(error.message, /HTTP 400: invalid_grant/);
      assert.doesNotMatch(error.message, /secreto/);
      return true;
    }
  );
});

test('callback com resposta do Google sem Content-Type persiste a credencial e redireciona para success', async () => {
  const { calls, restore } = installFetch({ google: () => googleResponse(GOOGLE_BODY) });
  const logs = captureLogs();
  let response;
  try {
    const url = `https://app.test/api/google/oauth/callback?code=auth-code-xyz&state=${encodeURIComponent(signedState(USER_ID))}`;
    response = await GET(new Request(url));
  } finally {
    logs.restore();
    restore();
  }

  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get('location')).pathname + new URL(response.headers.get('location')).search, '/contrato?google_oauth=success');

  assert.equal(calls.google.length, 1);
  assert.equal(calls.google[0].body.get('code'), 'auth-code-xyz');
  assert.equal(calls.google[0].body.get('client_id'), process.env.GOOGLE_OAUTH_CLIENT_ID);
  assert.equal(calls.google[0].body.get('redirect_uri'), process.env.GOOGLE_OAUTH_REDIRECT_URI);

  assert.equal(calls.upserts.length, 1);
  const row = Array.isArray(calls.upserts[0]) ? calls.upserts[0][0] : calls.upserts[0];
  assert.equal(row.user_id, USER_ID);
  assert.equal(row.status, 'valid');
  assert.equal(row.is_active, true);
  assert.equal(row.credentials.access_token, GOOGLE_BODY.access_token);
  assert.equal(row.credentials.refresh_token, GOOGLE_BODY.refresh_token);
  assert.equal(row.credentials.token_type, 'Bearer');
  assert.equal(row.credentials.scope, GOOGLE_BODY.scope);
  assert.equal(typeof row.credentials.expiry_date, 'number');

  const logged = logs.text();
  for (const secret of [GOOGLE_BODY.access_token, GOOGLE_BODY.refresh_token, 'auth-code-xyz', 'client-secret-test', 'ya29', '1//']) {
    assert.equal(logged.includes(secret), false, `log expôs ${secret}`);
  }
});

test('callback com troca recusada pelo Google responde 400 sem persistir', async () => {
  const { calls, restore } = installFetch({ google: () => googleResponse({ error: 'invalid_grant' }, 400) });
  const logs = captureLogs();
  let response;
  try {
    const url = `https://app.test/api/google/oauth/callback?code=used-code&state=${encodeURIComponent(signedState(USER_ID))}`;
    response = await GET(new Request(url));
  } finally {
    logs.restore();
    restore();
  }
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.message, /invalid_grant/);
  assert.equal(calls.upserts.length, 0);
});

test('callback com state inválido não chega a chamar o Google', async () => {
  const { calls, restore } = installFetch({ google: () => googleResponse(GOOGLE_BODY) });
  const logs = captureLogs();
  let response;
  try {
    response = await GET(new Request('https://app.test/api/google/oauth/callback?code=c&state=a.b.c.d'));
  } finally {
    logs.restore();
    restore();
  }
  assert.equal(response.status, 400);
  assert.equal(calls.google.length, 0);
  assert.equal(calls.upserts.length, 0);
});
