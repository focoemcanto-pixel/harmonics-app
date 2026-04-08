import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGoogleClientCredentials,
  getRevocableGoogleTokens,
  normalizeGoogleCredentials,
  validateGoogleCredentials,
  validateGoogleOAuthTokensForStorage,
} from '../lib/contracts/googleCredentials.js';

test('normalizeGoogleCredentials aceita token puro', () => {
  const result = normalizeGoogleCredentials('1//token-puro');
  assert.equal(result.refresh_token, '1//token-puro');
});

test('normalizeGoogleCredentials aceita JSON serializado', () => {
  const result = normalizeGoogleCredentials('{"refresh_token":"1//token-json"}');
  assert.equal(result.refresh_token, '1//token-json');
});

test('normalizeGoogleCredentials aceita objeto com tokens.refresh_token', () => {
  const result = normalizeGoogleCredentials({ tokens: { refresh_token: '1//token-nested' } });
  assert.equal(result.refresh_token, '1//token-nested');
});

test('normalizeGoogleCredentials mantém objeto com refresh_token no topo', () => {
  const result = normalizeGoogleCredentials({ refresh_token: ' 1//token-root  ', extra: true });
  assert.equal(result.refresh_token, '1//token-root');
  assert.equal(result.extra, true);
});

test('validateGoogleCredentials reprova payload vazio', () => {
  const validation = validateGoogleCredentials('');
  assert.equal(validation.valid, false);
  assert.equal(validation.reason, 'empty_credentials');
});

test('validateGoogleCredentials reprova refresh_token curto', () => {
  const validation = validateGoogleCredentials({ refresh_token: 'short' });
  assert.equal(validation.valid, false);
  assert.equal(validation.reason, 'invalid_refresh_token_format');
});

test('validateGoogleOAuthTokensForStorage reprova payload não-objeto', () => {
  const validation = validateGoogleOAuthTokensForStorage('1//token-invalido');
  assert.equal(validation.valid, false);
  assert.equal(validation.reason, 'tokens_not_object');
});

test('validateGoogleOAuthTokensForStorage aprova payload com refresh_token válido', () => {
  const validation = validateGoogleOAuthTokensForStorage({
    refresh_token: '1//token-refresh-longo',
    access_token: 'ya29.token',
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.credentials.refresh_token, '1//token-refresh-longo');
});

test('buildGoogleClientCredentials normaliza payload para setCredentials()', () => {
  const validation = buildGoogleClientCredentials({
    refresh_token: '1//token-refresh-longo',
    access_token: 'ya29.access',
    token_type: 'Bearer',
    expiry_date: '1712499999999',
  });

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.credentials, {
    refresh_token: '1//token-refresh-longo',
    access_token: 'ya29.access',
    token_type: 'Bearer',
    expiry_date: 1712499999999,
  });
});

test('buildGoogleClientCredentials reprova refresh_token ausente', () => {
  const validation = buildGoogleClientCredentials({ access_token: 'ya29.access' });
  assert.equal(validation.valid, false);
  assert.equal(validation.reason, 'missing_refresh_token');
});

test('getRevocableGoogleTokens retorna tokens únicos para revogação', () => {
  const tokens = getRevocableGoogleTokens({
    refresh_token: '1//token-refresh',
    access_token: 'ya29.access',
    tokens: {
      refresh_token: '1//token-refresh',
      id_token: 'ey.id.token',
    },
  });

  assert.deepEqual(tokens, ['1//token-refresh', 'ya29.access', 'ey.id.token']);
});
