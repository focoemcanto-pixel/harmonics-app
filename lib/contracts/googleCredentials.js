import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { google } from 'googleapis';

const GOOGLE_CREDENTIALS_TABLE = 'google_oauth_credentials';
const HMAC_SECRET = process.env.OAUTH_STATE_SECRET || 'default-secret-key';
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutos

// ============================================================================
// FUNÇÕES EXISTENTES (mantidas)
// ============================================================================

export function normalizeGoogleCredentials(rawValue) {
  if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    const tokenFromRoot = String(rawValue.refresh_token || '').trim();
    if (tokenFromRoot) {
      return {
        ...rawValue,
        refresh_token: tokenFromRoot,
      };
    }

    const tokenFromNested = String(rawValue?.tokens?.refresh_token || '').trim();
    if (tokenFromNested) {
      return {
        ...(rawValue.tokens && typeof rawValue.tokens === 'object' ? rawValue.tokens : {}),
        refresh_token: tokenFromNested,
      };
    }
  }

  const value = String(rawValue ?? '').trim();
  if (!value) return {};

  const unquoted = value.replace(/^"(.*)"$/, '$1').trim();

  if (unquoted.startsWith('{') && unquoted.endsWith('}')) {
    try {
      const parsed = JSON.parse(unquoted);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return normalizeGoogleCredentials(parsed);
      }
    } catch {
      // fallback para token puro
    }
  }

  return {
    refresh_token: unquoted,
  };
}

export function validateGoogleCredentials(rawValue) {
  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
    return {
      valid: false,
      reason: 'empty_credentials',
      message: 'Credenciais OAuth vazias.',
      credentials: {},
    };
  }

  const normalized = normalizeGoogleCredentials(rawValue);
  const refreshToken = String(normalized?.refresh_token || '').trim();

  if (!refreshToken) {
    return {
      valid: false,
      reason: 'missing_refresh_token',
      message: 'refresh_token ausente nas credenciais OAuth.',
      credentials: normalized,
    };
  }

  if (refreshToken.length < 10) {
    return {
      valid: false,
      reason: 'invalid_refresh_token_format',
      message: 'refresh_token inválido: tamanho muito curto.',
      credentials: normalized,
    };
  }

  return {
    valid: true,
    reason: 'ok',
    message: 'Credenciais OAuth válidas.',
    credentials: {
      ...normalized,
      refresh_token: refreshToken,
    },
  };
}

export function validateGoogleOAuthTokensForStorage(tokens) {
  if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
    return {
      valid: false,
      reason: 'tokens_not_object',
      message: 'Tokens OAuth inválidos: payload não é um objeto.',
      credentials: {},
    };
  }

  const accessToken = String(tokens.access_token || '').trim();
  if (!accessToken) {
    return {
      valid: false,
      reason: 'missing_access_token',
      message: 'access_token ausente no payload OAuth.',
      credentials: {},
    };
  }

  return validateGoogleCredentials(tokens);
}

export function maskToken(value) {
  const token = String(value || '').trim();
  if (!token) return '(empty)';
  if (token.length <= 10) return `${token.slice(0, 2)}***`;
  return `${token.slice(0, 6)}***${token.slice(-4)}`;
}

function getSupabaseAdminClient() {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!supabaseUrl || !serviceRole) return null;
  return createClient(supabaseUrl, serviceRole);
}

export async function loadGoogleCredentialsFromSupabase() {
  return loadGoogleCredentialsFromSupabaseByUserId();
}

export async function loadGoogleCredentialsFromSupabaseByUserId(userId = null) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return {
      credentials: {},
      source: 'supabase_unavailable',
      validation: validateGoogleCredentials(null),
    };
  }

  let query = client
    .from(GOOGLE_CREDENTIALS_TABLE)
    .select('credentials, updated_at, user_id')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (userId) {
    query = query.eq('user_id', userId);
  } else {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('[googleCredentials] falha ao ler credenciais no Supabase:', error);
    return {
      credentials: {},
      source: 'supabase_error',
      validation: validateGoogleCredentials(null),
    };
  }

  const validation = validateGoogleCredentials(data?.credentials);

  console.info('[googleCredentials] leitura de credenciais no Supabase:', {
    hasRow: Boolean(data),
    rawType: typeof data?.credentials,
    validationReason: validation.reason,
    refreshTokenResolved: maskToken(validation.credentials.refresh_token),
  });

  return {
    credentials: validation.credentials,
    source: data ? 'supabase' : 'supabase_empty',
    validation,
  };
}

export async function loadExistingRefreshTokenByUserId(client, userId) {
  if (!userId) return '';

  const { data } = await client
    .from(GOOGLE_CREDENTIALS_TABLE)
    .select('credentials')
    .eq('user_id', userId)
    .maybeSingle();

  return String(data?.credentials?.refresh_token || '').trim();
}

export async function loadExistingGoogleRefreshTokenByUserId(userId) {
  const client = getSupabaseAdminClient();
  if (!client) return '';
  return loadExistingRefreshTokenByUserId(client, userId);
}

export async function persistGoogleCredentialsToSupabase(rawCredentials, options = {}) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return {
      persisted: false,
      reason: 'supabase_unavailable',
    };
  }

  const userId = String(options?.userId || '').trim();
  if (!userId) {
    return {
      persisted: false,
      reason: 'missing_user_id',
      message: 'user_id é obrigatório para persistir credenciais OAuth por usuário.',
    };
  }

  const existingRefreshToken = await loadExistingRefreshTokenByUserId(client, userId);

  const mergedCredentials = {
    ...(rawCredentials && typeof rawCredentials === 'object' ? rawCredentials : {}),
    refresh_token:
      String(rawCredentials?.refresh_token || '').trim() || existingRefreshToken || undefined,
  };

  const tokenValidation = validateGoogleOAuthTokensForStorage(mergedCredentials);
  if (!tokenValidation.valid && tokenValidation.reason !== 'missing_refresh_token') {
    return {
      persisted: false,
      reason: tokenValidation.reason,
      message: tokenValidation.message,
    };
  }

  const validation = validateGoogleCredentials(mergedCredentials);

  if (!validation.valid) {
    return {
      persisted: false,
      reason: validation.reason,
      message: validation.message,
    };
  }

  if (
    !validation.credentials ||
    typeof validation.credentials !== 'object' ||
    Array.isArray(validation.credentials)
  ) {
    return {
      persisted: false,
      reason: 'credentials_not_object',
      message: 'Credenciais OAuth inválidas para persistência (esperado objeto JSON).',
    };
  }

  console.info('[googleCredentials] persistindo credenciais OAuth:', {
    credentialsType: typeof validation.credentials,
    credentialKeys: Object.keys(validation.credentials),
    hasAccessToken: Boolean(validation.credentials.access_token),
    hasRefreshToken: Boolean(validation.credentials.refresh_token),
  });

  const { error } = await client
    .from(GOOGLE_CREDENTIALS_TABLE)
    .upsert(
      {
        user_id: userId,
        credentials: validation.credentials,
        status: 'valid',
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    );

  if (error) {
    console.error('[googleCredentials] falha ao persistir credenciais no Supabase:', error);
    const normalizedMessage = String(error?.message || '').toLowerCase();
    const isUniqueConstraint =
      String(error?.code || '') === '23505' ||
      normalizedMessage.includes('duplicate key') ||
      normalizedMessage.includes('unique');

    return {
      persisted: false,
      reason: isUniqueConstraint ? 'unique_constraint_violation' : 'supabase_error',
      error,
    };
  }

  return {
    persisted: true,
    reason: 'ok',
  };
}

export async function deactivateGoogleCredentials(reason = 'invalid_credentials') {
  return deactivateGoogleCredentialsByUserId(null, reason);
}

export async function deactivateGoogleCredentialsByUserId(userId, reason = 'invalid_credentials') {
  const client = getSupabaseAdminClient();
  if (!client) {
    return {
      updated: false,
      reason: 'supabase_unavailable',
    };
  }

  let query = client.from(GOOGLE_CREDENTIALS_TABLE).update({
    is_active: false,
    status: 'expired',
    updated_at: new Date().toISOString(),
    credentials: {
      invalidated_reason: reason,
    },
  });

  if (userId) {
    query = query.eq('user_id', userId);
  } else {
    query = query.eq('provider', 'google');
  }

  const { error } = await query;

  if (error) {
    return {
      updated: false,
      reason: 'supabase_error',
      error,
    };
  }

  return {
    updated: true,
    reason: 'ok',
  };
}

export async function markGoogleCredentialAsRevokedByUserId(userId) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { updated: false, reason: 'supabase_unavailable' };
  }

  const { error } = await client
    .from(GOOGLE_CREDENTIALS_TABLE)
    .update({
      status: 'revoked',
      is_active: false,
      credentials: {},
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    return { updated: false, reason: 'supabase_error', error };
  }

  return { updated: true, reason: 'ok' };
}

// ============================================================================
// NOVAS FUNÇÕES: OAUTH2 STATE COM SEGURANÇA HMAC
// ============================================================================

/**
 * Gera state com segurança criptográfica (HMAC-SHA256)
 * Formato: userId|timestamp|nonce|hmac
 * @param {string} userId - ID do usuário
 * @returns {string} State seguro para OAuth
 */
export function generateSecureState(userId) {
  try {
    console.error('[STATE-GENERATE] Iniciando geração para userId:', userId);

    if (!userId || typeof userId !== 'string') {
      throw new Error('userId deve ser uma string válida');
    }

    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const payload = `${userId}|${timestamp}|${nonce}`;

    const hmac = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(payload)
      .digest('hex');

    const state = `${payload}|${hmac}`;

    console.error('[STATE-GENERATE] SUCCESS:', {
      userId,
      timestamp,
      nonce: `${nonce.substring(0, 8)}...`,
      state: `${state.substring(0, 30)}...`,
    });

    return state;
  } catch (error) {
    console.error('[STATE-GENERATE] FAILED:', error.message);
    throw error;
  }
}

/**
 * Valida state com HMAC e timestamp
 * @param {string} state - State recebido da URL de callback
 * @returns {object} { userId, timestamp, valid: boolean, error?: string }
 */
export function validateSecureState(state) {
  try {
    console.error('[STATE-VALIDATE] Iniciando validação');

    if (!state || typeof state !== 'string') {
      throw new Error('State ausente ou inválido');
    }

    const parts = state.split('|');
    if (parts.length !== 4) {
      throw new Error(`Formato de state inválido: esperado 4 partes, recebido ${parts.length}`);
    }

    const [userId, timestamp, nonce, receivedHmac] = parts;

    const stateAge = Date.now() - parseInt(timestamp, 10);
    if (stateAge > STATE_EXPIRY_MS) {
      throw new Error(
        `State expirado: ${Math.round(stateAge / 1000)}s atrás (limite: ${Math.round(
          STATE_EXPIRY_MS / 1000
        )}s)`
      );
    }

    const payload = `${userId}|${timestamp}|${nonce}`;
    const expectedHmac = crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');

    if (receivedHmac !== expectedHmac) {
      throw new Error('State HMAC inválido - possível ataque CSRF');
    }

    console.error('[STATE-VALIDATE] SUCCESS para userId:', userId);

    return {
      userId,
      timestamp: parseInt(timestamp, 10),
      valid: true,
    };
  } catch (error) {
    console.error('[STATE-VALIDATE] FAILED:', error.message);
    return {
      valid: false,
      error: error.message,
    };
  }
}

// ============================================================================
// NOVAS FUNÇÕES: GOOGLE OAUTH2 CLIENT
// ============================================================================

/**
 * Cria nova instância do OAuth2Client
 * @returns {object} google.auth.OAuth2
 */
export function getOAuth2Client() {
  try {
    const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
    const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
    const redirectUri = String(process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Variáveis de ambiente Google OAuth não configuradas');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    console.error('[OAUTH2-CLIENT] Inicializado com sucesso');

    return oauth2Client;
  } catch (error) {
    console.error('[OAUTH2-CLIENT] FAILED:', error.message);
    throw error;
  }
}

/**
 * Obtém credenciais do banco e retorna OAuth2Client configurado
 * @param {string} userId - ID do usuário
 * @returns {object} google.auth.OAuth2 com credenciais carregadas
 */
export async function getGoogleAuthClient(userId) {
  try {
    console.error('[GET-AUTH-CLIENT] Carregando para userId:', userId);

    if (!userId || typeof userId !== 'string') {
      throw new Error('userId inválido');
    }

    const client = getSupabaseAdminClient();
    if (!client) {
      throw new Error('Cliente Supabase indisponível');
    }

    const { data, error } = await client
      .from(GOOGLE_CREDENTIALS_TABLE)
      .select('credentials')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new Error('Credenciais não encontradas no banco para este usuário');
    }

    let credentials = data.credentials;

    if (typeof credentials === 'string') {
      try {
        credentials = JSON.parse(credentials);
      } catch (_e) {
        throw new Error('Credenciais em formato JSON inválido');
      }
    }

    const validation = validateGoogleCredentials(credentials);
    if (!validation.valid) {
      throw new Error(`Credenciais inválidas: ${validation.reason}`);
    }

    const oauth2Client = getOAuth2Client();

    console.error('[GET-AUTH-CLIENT] antes do setCredentials:', {
      oauth2CredentialsType: typeof oauth2Client.credentials,
      oauth2CredentialsIsArray: Array.isArray(oauth2Client.credentials),
      loadedCredentialsType: typeof credentials,
      loadedCredentialsIsArray: Array.isArray(credentials),
      hasRefreshToken: !!validation?.credentials?.refresh_token,
      hasAccessToken: !!validation?.credentials?.access_token,
      refreshTokenMasked: maskToken(validation?.credentials?.refresh_token),
      accessTokenMasked: maskToken(validation?.credentials?.access_token),
    });

    if (!oauth2Client.credentials || typeof oauth2Client.credentials !== 'object') {
      oauth2Client.credentials = {};
    }

    oauth2Client.setCredentials({
      refresh_token: validation.credentials.refresh_token,
      access_token: validation.credentials.access_token,
      token_type: validation.credentials.token_type || 'Bearer',
      expiry_date: validation.credentials.expiry_date,
    });

    console.error('[GET-AUTH-CLIENT] depois do setCredentials:', {
      oauth2CredentialsType: typeof oauth2Client.credentials,
      oauth2CredentialsIsArray: Array.isArray(oauth2Client.credentials),
      hasRefreshToken: !!oauth2Client?.credentials?.refresh_token,
      hasAccessToken: !!oauth2Client?.credentials?.access_token,
      refreshTokenMasked: maskToken(oauth2Client?.credentials?.refresh_token),
      accessTokenMasked: maskToken(oauth2Client?.credentials?.access_token),
    });

    console.error('[GET-AUTH-CLIENT] SUCCESS para userId:', userId);

    return oauth2Client;
  } catch (error) {
    console.error('[GET-AUTH-CLIENT] FAILED:', error.message);
    throw error;
  }
}

/**
 * Revoga token no Google e marca como revogado no banco
 * @param {string} refreshToken - Refresh token a revogar
 * @param {string} userId - ID do usuário (para marcar no banco)
 */
export async function revokeGoogleToken(refreshToken, userId) {
  try {
    console.error('[REVOKE-TOKEN] Iniciando revogação para userId:', userId);

    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new Error('refresh_token inválido');
    }

    const oauth2Client = getOAuth2Client();

    if (!oauth2Client.credentials || typeof oauth2Client.credentials !== 'object') {
      oauth2Client.credentials = {};
    }

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    await oauth2Client.revokeToken(refreshToken);
    console.error('[REVOKE-TOKEN] Token revogado com sucesso no Google');

    if (userId) {
      const result = await markGoogleCredentialAsRevokedByUserId(userId);
      if (!result.updated) {
        console.error('[REVOKE-TOKEN] Falha ao marcar como revogado no banco:', result.reason);
      }
    }

    return { revoked: true, reason: 'ok' };
  } catch (error) {
    console.error('[REVOKE-TOKEN] FAILED:', error.message);
    return { revoked: false, reason: error.message };
  }
}
