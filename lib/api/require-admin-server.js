import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function unauthorizedResponse(status = 401) {
  return NextResponse.json({ ok: false, error: 'Acesso não autorizado.' }, { status });
}

function getBearerToken(request) {
  const authHeader = String(request?.headers?.get('authorization') || '').trim();

  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  return token || null;
}

function createCookieSupabaseClient(request) {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const supabaseAnonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  if (!supabaseUrl || !supabaseAnonKey || !request?.cookies?.getAll) {
    return null;
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Guard de API só precisa ler sessão; não deve mutar cookies aqui.
      },
    },
  });
}

async function resolveRequestUser(request) {
  const supabaseClient = createCookieSupabaseClient(request);

  if (!supabaseClient) {
    return { user: null, error: new Error('Supabase client indisponível para validar sessão.') };
  }

  const token = getBearerToken(request);

  if (token) {
    const { data, error } = await supabaseClient.auth.getUser(token);
    return { user: data?.user || null, error: error || null };
  }

  const { data, error } = await supabaseClient.auth.getUser();
  return { user: data?.user || null, error: error || null };
}

export async function requireAdminServer(request) {
  const { user, error: userError } = await resolveRequestUser(request);

  if (userError || !user?.id) {
    return { ok: false, response: unauthorizedResponse(401) };
  }

  const supabaseClient = createCookieSupabaseClient(request);

  if (!supabaseClient) {
    return { ok: false, response: unauthorizedResponse(401) };
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false, response: unauthorizedResponse(403) };
  }

  if (String(profile.role || '').trim().toLowerCase() !== 'admin') {
    return { ok: false, response: unauthorizedResponse(403) };
  }

  return { ok: true, user, profile };
}
