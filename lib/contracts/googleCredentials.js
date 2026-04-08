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

    return {
      ...rawValue,
    };
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
  if (!tokens || typeof tokens !== 'object') {
    return {
      valid: false,
      reason: 'tokens_not_object',
      message: 'Tokens OAuth inválidos: payload não é um objeto.',
      credentials: {},
    };
  }

  return validateGoogleCredentials(tokens);
}

export function buildGoogleClientCredentials(rawValue) {
  const validation = validateGoogleCredentials(rawValue);
  if (!validation.valid) {
    return {
      valid: false,
      reason: validation.reason,
      message: validation.message,
      credentials: {},
    };
  }

  const normalized = validation.credentials;
  const credentials = {
    refresh_token: normalized.refresh_token,
  };

  const accessToken = String(normalized.access_token || '').trim();
  if (accessToken) {
    credentials.access_token = accessToken;
  }

  const tokenType = String(normalized.token_type || '').trim();
  if (tokenType) {
    credentials.token_type = tokenType;
  }

  const expiryDate = Number(normalized.expiry_date);
  if (Number.isFinite(expiryDate) && expiryDate > 0) {
    credentials.expiry_date = expiryDate;
  }

  return {
    valid: true,
    reason: 'ok',
    message: 'Credenciais prontas para setCredentials().',
    credentials,
  };
}

export function getRevocableGoogleTokens(rawValue) {
  const normalized = normalizeGoogleCredentials(rawValue);
  const candidates = [
    normalized?.refresh_token,
    normalized?.access_token,
    normalized?.id_token,
    normalized?.tokens?.refresh_token,
    normalized?.tokens?.access_token,
    normalized?.tokens?.id_token,
  ];

  const uniqueTokens = [];
  const seen = new Set();

  for (const tokenValue of candidates) {
    const token = String(tokenValue || '').trim();
    if (!token || seen.has(token)) continue;
    seen.add(token);
    uniqueTokens.push(token);
  }

  return uniqueTokens;
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
  const client = getSupabaseAdminClient();
  if (!client) {
    return {
      credentials: {},
      source: 'supabase_unavailable',
      validation: validateGoogleCredentials(null),
    };
  }

  const { data, error } = await client
    .from(GOOGLE_CREDENTIALS_TABLE)
    .select('credentials, updated_at')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

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
    rawCredentials: data?.credentials || null,
    source: data ? 'supabase' : 'supabase_empty',
    validation,
  };
}

export async function persistGoogleCredentialsToSupabase(rawCredentials) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return {
      persisted: false,
      reason: 'supabase_unavailable',
    };
  }

  const validation = validateGoogleCredentials(rawCredentials);

  if (!validation.valid) {
    return {
      persisted: false,
      reason: validation.reason,
      message: validation.message,
    };
  }

  const { error } = await client
    .from(GOOGLE_CREDENTIALS_TABLE)
    .upsert(
      {
        provider: 'google',
        credentials: validation.credentials,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'provider',
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
  const client = getSupabaseAdminClient();
  if (!client) {
    return {
      updated: false,
      reason: 'supabase_unavailable',
    };
  }

  const { error } = await client
    .from(GOOGLE_CREDENTIALS_TABLE)
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
      credentials: {
        invalidated_reason: reason,
      },
    })
    .eq('provider', 'google');

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
