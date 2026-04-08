import { createClient } from '@supabase/supabase-js';

const GOOGLE_CREDENTIALS_TABLE = 'google_oauth_credentials';

export function normalizeGoogleCredentials(rawValue) {
  if (rawValue && typeof rawValue === 'object') {
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
      if (parsed && typeof parsed === 'object') {
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

async function loadExistingRefreshTokenByUserId(client, userId) {
  if (!userId) return '';

  const { data } = await client
    .from(GOOGLE_CREDENTIALS_TABLE)
    .select('credentials')
    .eq('user_id', userId)
    .maybeSingle();

  return String(data?.credentials?.refresh_token || '').trim();
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
        provider: 'google',
        user_id: userId,
        credentials: validation.credentials,
        status: 'valid',
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'provider,user_id',
      }
    );

  if (error) {
    console.error('[googleCredentials] falha ao persistir credenciais no Supabase:', error);
    return {
      persisted: false,
      reason: 'supabase_error',
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
