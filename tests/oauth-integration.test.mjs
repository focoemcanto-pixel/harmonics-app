import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { google } from 'googleapis';

process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id';
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'client-secret';
process.env.GOOGLE_OAUTH_REDIRECT_URI = 'https://app.local/api/google/oauth/callback';
process.env.GOOGLE_OAUTH_STATE_SECRET = 'state-secret-for-tests';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';

let oauthInstances = [];
let nextTokenResponse = {
  tokens: {
    access_token: 'ya29.initial-access-token',
    refresh_token: '1//initial-refresh-token-long',
  },
};
let revokedTokens = [];

class FakeOAuth2 {
  constructor(clientId, clientSecret, redirectUri) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.credentials = {};
    oauthInstances.push(this);
  }

  generateAuthUrl(options) {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('scope', (options.scope || []).join(' '));
    url.searchParams.set('state', options.state || '');
    url.searchParams.set('access_type', options.access_type || '');
    url.searchParams.set('prompt', options.prompt || '');
    return url.toString();
  }

  async getToken() {
    return nextTokenResponse;
  }

  setCredentials(credentials) {
    this.credentials = credentials;
  }

  async revokeToken(token) {
    revokedTokens.push(token);
    return { status: 200 };
  }
}

google.auth.OAuth2 = FakeOAuth2;

const inMemoryDb = new Map();

function buildSupabaseResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseJsonBody(init) {
  try {
    return JSON.parse(init?.body || '{}');
  } catch {
    return {};
  }
}

const originalFetch = global.fetch;

global.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (!url.hostname.includes('supabase.test')) {
    return originalFetch(input, init);
  }

  const method = (init.method || 'GET').toUpperCase();
  const pathname = url.pathname;

  if (!pathname.includes('/rest/v1/google_oauth_credentials')) {
    return buildSupabaseResponse({ error: 'not_found' }, 404);
  }

  const userIdFilter = url.searchParams.get('user_id');
  const userId = userIdFilter?.startsWith('eq.') ? userIdFilter.slice(3) : '';

  if (method === 'GET') {
    const row = inMemoryDb.get(userId) || null;
    return buildSupabaseResponse(row);
  }

  if (method === 'POST') {
    const payload = parseJsonBody(init);
    const row = Array.isArray(payload) ? payload[0] : payload;

    if (row?.user_id === 'conflict-user') {
      return buildSupabaseResponse(
        {
          code: '23505',
          message: 'duplicate key value violates unique constraint',
        },
        409
      );
    }

    inMemoryDb.set(row.user_id, {
      user_id: row.user_id,
      credentials: row.credentials,
      status: row.status,
      is_active: row.is_active,
      updated_at: row.updated_at,
    });

    return buildSupabaseResponse({});
  }

  if (method === 'PATCH') {
    const payload = parseJsonBody(init);
    const existing = inMemoryDb.get(userId) || { user_id: userId };
    const updated = {
      ...existing,
      ...payload,
    };
    inMemoryDb.set(userId, updated);
    return buildSupabaseResponse([updated]);
  }

  return buildSupabaseResponse({ error: 'unsupported_method' }, 405);
};

const startRoute = await import('../app/api/google/oauth/start/route.js');
const callbackRoute = await import('../app/api/google/oauth/callback/route.js');

function parseStateFromAuthUrl(authUrl) {
  const url = new URL(authUrl);
  return url.searchParams.get('state');
}

function validateStateHmac(state) {
  const [nonce = '', encodedUserId = '', issuedAt = '', signature = ''] = String(state || '').split('.');
  const payload = `${nonce}.${encodedUserId}.${issuedAt}`;
  const expected = crypto
    .createHmac('sha256', process.env.GOOGLE_OAUTH_STATE_SECRET)
    .update(payload)
    .digest('base64url');

  return {
    matches: signature === expected,
    issuedAt,
  };
}

test('integração E2E: start -> callback -> reautenticação sem novo refresh_token', async () => {
  const userId = 'user-e2e-1';

  const startResponse = await startRoute.GET({ user: { id: userId } });
  assert.equal(startResponse.status, 307);

  const authUrl = startResponse.headers.get('location');
  assert.ok(authUrl, 'deve retornar authUrl no redirect location');

  const state = parseStateFromAuthUrl(authUrl);
  assert.ok(state, 'deve retornar state na URL de autorização');

  const stateValidation = validateStateHmac(state);
  assert.equal(stateValidation.matches, true, 'state deve ter HMAC válido');

  const issuedAtMs = Number(stateValidation.issuedAt);
  assert.equal(Number.isFinite(issuedAtMs), true);
  assert.equal(Date.now() - issuedAtMs < 10 * 60 * 1000, true, 'state não pode estar expirado');

  const callbackUrl = `https://app.local/api/google/oauth/callback?code=auth-code-1&state=${encodeURIComponent(state)}`;
  const callbackResponse = await callbackRoute.GET(new Request(callbackUrl));
  assert.equal(callbackResponse.status, 200);

  const callbackPayload = await callbackResponse.json();
  assert.equal(callbackPayload.ok, true);
  assert.equal(callbackPayload.persistence.persisted, true);
  assert.equal(inMemoryDb.get(userId)?.credentials?.refresh_token, '1//initial-refresh-token-long');

  nextTokenResponse = {
    tokens: {
      access_token: 'ya29.updated-access-token',
    },
  };

  const callbackResponseReauth = await callbackRoute.GET(
    new Request(`https://app.local/api/google/oauth/callback?code=auth-code-2&state=${encodeURIComponent(state)}`)
  );
  assert.equal(callbackResponseReauth.status, 200);

  const reauthPayload = await callbackResponseReauth.json();
  assert.equal(reauthPayload.ok, true);

  const stored = inMemoryDb.get(userId)?.credentials;
  assert.equal(stored.refresh_token, '1//initial-refresh-token-long', 'refresh_token antigo deve ser mantido');
  assert.equal(stored.access_token, 'ya29.updated-access-token', 'access_token deve ser atualizado');
});

test('erro: start sem autenticação retorna 401', async () => {
  const response = await startRoute.GET({});
  assert.equal(response.status, 401);
  const payload = await response.json();
  assert.equal(payload.ok, false);
});

test('erro: callback com state inválido retorna 400 com razão específica', async () => {
  const response = await callbackRoute.GET(
    new Request('https://app.local/api/google/oauth/callback?code=abc&state=state-invalido')
  );
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.match(payload.message, /state_format_invalid|state inválido/i);
});

test('erro: callback com state expirado retorna 400', async () => {
  const expiredIssuedAt = Date.now() - 11 * 60 * 1000;
  const nonce = 'nonceexpirado123456';
  const encodedUserId = Buffer.from('user-expired').toString('base64url');
  const payload = `${nonce}.${encodedUserId}.${expiredIssuedAt}`;
  const signature = crypto
    .createHmac('sha256', process.env.GOOGLE_OAUTH_STATE_SECRET)
    .update(payload)
    .digest('base64url');
  const expiredState = `${payload}.${signature}`;

  const response = await callbackRoute.GET(
    new Request(`https://app.local/api/google/oauth/callback?code=abc&state=${encodeURIComponent(expiredState)}`)
  );

  assert.equal(response.status, 400);
  const json = await response.json();
  assert.match(json.message, /state_expired/i);
});

test('erro: callback com tokens inválidos retorna 400', async () => {
  nextTokenResponse = { tokens: { refresh_token: '1//refresh-sem-access' } };

  const startResponse = await startRoute.GET({ user: { id: 'user-token-invalid' } });
  const state = parseStateFromAuthUrl(startResponse.headers.get('location'));

  const response = await callbackRoute.GET(
    new Request(`https://app.local/api/google/oauth/callback?code=abc&state=${encodeURIComponent(state)}`)
  );

  assert.equal(response.status, 400);
  const json = await response.json();
  assert.match(json.message, /Tokens OAuth inválidos|access_token ausente/i);
});

test('erro: conflito de constraint única no Supabase retorna 409', async () => {
  nextTokenResponse = {
    tokens: {
      access_token: 'ya29.conflict-access',
      refresh_token: '1//conflict-refresh-token-long',
    },
  };

  const startResponse = await startRoute.GET({ user: { id: 'conflict-user' } });
  const state = parseStateFromAuthUrl(startResponse.headers.get('location'));

  const response = await callbackRoute.GET(
    new Request(`https://app.local/api/google/oauth/callback?code=abc&state=${encodeURIComponent(state)}`)
  );

  assert.equal(response.status, 409);
  const json = await response.json();
  assert.match(json.message, /constraint única|Conflito de credenciais/i);
});

test('revogação: revoga token no Google e marca credencial como revoked no banco', async () => {
  const userId = 'user-revoke';
  inMemoryDb.set(userId, {
    user_id: userId,
    credentials: {
      access_token: 'ya29.active',
      refresh_token: '1//refresh-to-revoke-long',
    },
    status: 'valid',
    is_active: true,
  });

  const result = await callbackRoute.revokeToken('1//refresh-to-revoke-long', userId);

  assert.equal(result.updated, true);
  assert.equal(revokedTokens.includes('1//refresh-to-revoke-long'), true);

  const stored = inMemoryDb.get(userId);
  assert.equal(stored.status, 'revoked');
  assert.equal(stored.is_active, false);
  assert.deepEqual(stored.credentials, {});
});
