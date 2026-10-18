import test from 'node:test';
import assert from 'node:assert/strict';
import { getAccessTokenFromCookieList, getUserFromCookieSession } from '../lib/auth/cookie-access-token.js';
import { isActiveMemberContact } from '../lib/api/require-workspace-access.js';

const session = { access_token: 'jwt-abc', refresh_token: 'rt-1', expires_at: 1 };
const encoded = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url');

test('lê o access token do cookie do @supabase/ssr (inteiro, em pedaços e formato antigo)', () => {
  assert.equal(getAccessTokenFromCookieList([{ name: 'sb-proj-auth-token', value: encoded }]), 'jwt-abc');
  const half = Math.ceil(encoded.length / 2);
  assert.equal(
    getAccessTokenFromCookieList([
      { name: 'sb-proj-auth-token.1', value: encoded.slice(half) },
      { name: 'sb-proj-auth-token.0', value: encoded.slice(0, half) },
    ]),
    'jwt-abc'
  );
  assert.equal(getAccessTokenFromCookieList([{ name: 'sb-proj-auth-token', value: encodeURIComponent(JSON.stringify(session)) }]), 'jwt-abc');
  assert.equal(getAccessTokenFromCookieList([{ name: 'sb-proj-auth-token-code-verifier', value: 'x' }]), null);
  assert.equal(getAccessTokenFromCookieList([{ name: 'sb-proj-auth-token', value: 'base64-@@@' }]), null);
});

test('valida o usuário com getUser(token) e nunca renova a sessão', async () => {
  const calls = [];
  const client = { auth: {
    getUser: async (jwt) => { calls.push(jwt); return { data: { user: { id: 'u1' } }, error: null }; },
    getSession: async () => { throw new Error('não deveria renovar/ler sessão'); },
    refreshSession: async () => { throw new Error('não deveria renovar'); },
  } };
  const request = { cookies: { getAll: () => [{ name: 'sb-proj-auth-token', value: encoded }] } };
  const { user } = await getUserFromCookieSession(client, request);
  assert.deepEqual(calls, ['jwt-abc']);
  assert.equal(user.id, 'u1');
  const empty = await getUserFromCookieSession(client, { cookies: { getAll: () => [] } });
  assert.equal(empty.user, null);
  assert.equal(calls.length, 1);
});

test('identifica conta de membro (contato ativo) com e-mail exato, escapando curingas', async () => {
  const seen = [];
  const supabase = { from: () => {
    const q = { select: () => q, ilike: (_c, v) => { seen.push(v); return q; }, neq: () => q, limit: async () => ({ data: seen.at(-1) === 'musico\\_x@ex.com' ? [{ id: 'c1' }] : [], error: null }) };
    return q;
  } };
  assert.equal(await isActiveMemberContact({ supabase, email: ' Musico_X@ex.com ' }), true);
  assert.equal(await isActiveMemberContact({ supabase, email: 'outro@ex.com' }), false);
  assert.equal(await isActiveMemberContact({ supabase, email: '' }), false);
});
