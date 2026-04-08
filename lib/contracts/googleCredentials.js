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
    };
  }

  const credentials = normalizeGoogleCredentials(data?.credentials);

  console.info('[googleCredentials] leitura de credenciais no Supabase:', {
    hasRow: Boolean(data),
    rawType: typeof data?.credentials,
    refreshTokenResolved: maskToken(credentials.refresh_token),
  });

  return {
    credentials,
    source: data ? 'supabase' : 'supabase_empty',
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

  const credentials = normalizeGoogleCredentials(rawCredentials);

  if (!credentials.refresh_token) {
    return {
      persisted: false,
      reason: 'missing_refresh_token',
    };
  }

  const { error } = await client
    .from(GOOGLE_CREDENTIALS_TABLE)
    .upsert(
      {
        provider: 'google',
        credentials,
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
