import { createServerClient } from '@supabase/ssr';

function normalizeRole(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function resolveAdminFromProfile(profile) {
  const role = normalizeRole(profile?.role);
  const isAdmin = profile?.is_admin === true || role === 'admin' || role === 'administrador';
  return { role, isAdmin };
}

function createCookieSupabaseClient(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !request?.cookies?.getAll) {
    return null;
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // API guards only read the current session. They must not mutate cookies here.
      },
    },
  });
}

async function resolveUserFromRequest({ supabase, request, logPrefix }) {
  const authHeader = String(request?.headers?.get('authorization') || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (token) {
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    return {
      source: 'bearer',
      user: userData?.user || null,
      error: userError || null,
    };
  }

  const cookieSupabase = createCookieSupabaseClient(request);

  if (!cookieSupabase) {
    console.warn(`${logPrefix}[AUTH][COOKIE_CLIENT]`, { message: 'cookie_client_unavailable' });
    return { source: 'cookie', user: null, error: null };
  }

  const { data: userData, error: userError } = await cookieSupabase.auth.getUser();

  return {
    source: 'cookie',
    user: userData?.user || null,
    error: userError || null,
  };
}

export async function requireAdminFromRequest({ supabase, request, logPrefix = '[ADMIN_GUARD]' }) {
  console.info(`${logPrefix}[AUTH][START]`);

  const authResult = await resolveUserFromRequest({ supabase, request, logPrefix });

  if (authResult.error || !authResult.user?.id) {
    console.warn(`${logPrefix}[AUTH][USER]`, {
      source: authResult.source,
      message: authResult.error?.message || 'missing_user',
    });
    return { ok: false, status: 401, error: 'Sessão expirada. Faça login novamente.' };
  }

  const userId = authResult.user.id;
  console.info(`${logPrefix}[AUTH][USER]`, { userId, source: authResult.source });

  let profile = null;
  const { data: profileWithIsAdmin, error: profileError } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    const missingIsAdminColumn = profileError?.code === '42703' || String(profileError?.message || '').includes('is_admin');

    if (!missingIsAdminColumn) {
      console.error(`${logPrefix}[AUTH][PROFILE]`, {
        message: profileError?.message,
        code: profileError?.code,
        details: profileError?.details,
      });
      return { ok: false, status: 500, error: 'Falha ao validar perfil do usuário.' };
    }

    console.warn(`${logPrefix}[AUTH][PROFILE]`, {
      message: 'is_admin_column_missing_fallback_to_role',
      originalMessage: profileError?.message,
    });

    const { data: fallbackProfile, error: fallbackError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (fallbackError) {
      console.error(`${logPrefix}[AUTH][PROFILE]`, {
        message: fallbackError?.message,
        code: fallbackError?.code,
        details: fallbackError?.details,
      });
      return { ok: false, status: 500, error: 'Falha ao validar perfil do usuário.' };
    }

    profile = fallbackProfile || null;
  } else {
    profile = profileWithIsAdmin || null;
  }

  console.info(`${logPrefix}[AUTH][PROFILE]`, {
    found: Boolean(profile),
    hasIsAdmin: Object.prototype.hasOwnProperty.call(profile || {}, 'is_admin'),
  });

  const { role, isAdmin } = resolveAdminFromProfile(profile);
  console.info(`${logPrefix}[AUTH][ROLE]`, { role, isAdminFlag: profile?.is_admin === true, isAdmin });

  if (!isAdmin) {
    return { ok: false, status: 403, error: 'Apenas administradores podem executar esta ação.' };
  }

  console.info(`${logPrefix}[AUTH][AUTHORIZED]`, { userId });
  return { ok: true, userId, role };
}

export async function requireAdmin(params) {
  return requireAdminFromRequest(params);
}
