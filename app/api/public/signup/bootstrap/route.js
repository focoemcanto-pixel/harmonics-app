import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { bootstrapWorkspaceForUser } from '@/lib/workspaces/bootstrap-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeText(value) {
  const text = String(value || '').trim();
  return text || null;
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
        // Esta rota só precisa ler sessão já criada pelo client.
      },
    },
  });
}

async function resolveUserFromRequest(request) {
  const admin = getSupabaseAdmin();
  const authHeader = String(request?.headers?.get('authorization') || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (token) {
    const { data, error } = await admin.auth.getUser(token);
    if (error) return { user: null, error };
    return { user: data?.user || null, error: null };
  }

  const cookieClient = createCookieSupabaseClient(request);
  if (!cookieClient) return { user: null, error: null };

  const { data, error } = await cookieClient.auth.getUser();
  return { user: data?.user || null, error: error || null };
}

async function userAlreadyHasWorkspace({ supabase, userId }) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('id, workspace_id, role, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function ensureProfileSafe({ supabase, user, fullName }) {
  try {
    const payload = {
      id: user.id,
      email: user.email,
      name: fullName || user.email,
      role: 'owner',
      is_admin: false,
    };

    const { data: existing, error: existingError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (existingError) return null;

    if (existing?.id) {
      const { data } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)
        .select('*')
        .maybeSingle();

      return data || null;
    }

    const { data } = await supabase
      .from('profiles')
      .insert(payload)
      .select('*')
      .maybeSingle();

    return data || null;
  } catch (error) {
    console.warn('[SIGNUP_BOOTSTRAP][PROFILE_SAFE_FAILED]', {
      message: error?.message,
      code: error?.code || null,
    });
    return null;
  }
}

export async function POST(request) {
  try {
    const supabase = getSupabaseAdmin();
    const { user, error: userError } = await resolveUserFromRequest(request);

    if (userError) {
      return NextResponse.json({ ok: false, error: userError.message }, { status: 401 });
    }

    if (!user?.id) {
      return NextResponse.json({ ok: false, error: 'Usuário não autenticado.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const fullName = normalizeText(body?.fullName || body?.name || user.user_metadata?.full_name);
    const workspaceName = normalizeText(body?.workspaceName || body?.companyName || body?.bandName);
    const supportWhatsapp = normalizeText(body?.supportWhatsapp || body?.whatsapp || body?.phone);
    const timezone = normalizeText(body?.timezone) || 'America/Bahia';

    if (!workspaceName) {
      return NextResponse.json({ ok: false, error: 'Nome do workspace é obrigatório.' }, { status: 400 });
    }

    const existingMembership = await userAlreadyHasWorkspace({ supabase, userId: user.id });
    if (existingMembership?.workspace_id) {
      return NextResponse.json({
        ok: true,
        alreadyBootstrapped: true,
        code: 'USER_ALREADY_HAS_WORKSPACE',
        user: {
          id: user.id,
          email: user.email,
        },
        membership: existingMembership,
        workspaceId: existingMembership.workspace_id,
        next: '/eventos',
      });
    }

    const profile = await ensureProfileSafe({ supabase, user, fullName });

    const bootstrap = await bootstrapWorkspaceForUser({
      supabase,
      userId: user.id,
      workspaceName,
      publicName: workspaceName,
      supportWhatsapp,
      timezone,
      source: 'public_signup_bootstrap_api',
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
      },
      profile,
      workspace: bootstrap.workspace,
      membership: bootstrap.ownerMembership,
      settings: bootstrap.settings,
      subscription: bootstrap.subscription,
      next: '/onboarding',
    });
  } catch (error) {
    console.error('[SIGNUP_BOOTSTRAP][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao inicializar workspace.' },
      { status: error?.statusCode || 500 }
    );
  }
}
