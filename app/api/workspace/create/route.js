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

function normalizeHexColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : null;
}

function isMissingColumnError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();

  return (
    code === '42703' ||
    message.includes('does not exist') ||
    message.includes('could not find') ||
    details.includes('schema cache')
  );
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
        // Esta rota só precisa ler a sessão já criada pelo client.
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

async function resetOnboardingProgressForWorkspace({ supabase, workspaceId }) {
  const now = new Date().toISOString();
  const progressPayload = {
    workspace_id: workspaceId,
    workspace_configured: false,
    template_created: false,
    event_type_created: false,
    precontract_created: false,
    contract_signed_test: false,
    first_event_created: false,
    automation_configured: false,
    team_configured: false,
    completed_at: null,
    flow_state: {
      onboarding_enabled: true,
      workspace_created_for_onboarding: true,
      onboarding_started_at: now,
      updatedAt: now,
    },
    updated_at: now,
  };

  const { error } = await supabase
    .from('workspace_onboarding_progress')
    .upsert(progressPayload, { onConflict: 'workspace_id' });

  if (error) {
    console.warn('[WORKSPACE_CREATE][ONBOARDING_RESET_FAILED]', {
      message: error?.message,
      code: error?.code || null,
    });
  }
}

async function updateProfileWorkspaceSafe({ supabase, user, workspaceId }) {
  const basePayload = {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.email,
    role: 'owner',
    is_admin: false,
  };

  const preferredPayload = {
    ...basePayload,
    workspace_id: workspaceId,
    current_workspace_id: workspaceId,
    default_workspace_id: workspaceId,
  };

  try {
    let { data, error } = await supabase
      .from('profiles')
      .upsert(preferredPayload, { onConflict: 'id' })
      .select('*')
      .maybeSingle();

    if (error && isMissingColumnError(error)) {
      const fallbackPayload = {
        ...basePayload,
        workspace_id: workspaceId,
      };

      const fallback = await supabase
        .from('profiles')
        .upsert(fallbackPayload, { onConflict: 'id' })
        .select('*')
        .maybeSingle();

      data = fallback.data;
      error = fallback.error;
    }

    if (error && isMissingColumnError(error)) {
      const legacy = await supabase
        .from('profiles')
        .upsert(basePayload, { onConflict: 'id' })
        .select('*')
        .maybeSingle();

      data = legacy.data;
      error = legacy.error;
    }

    if (error) throw error;
    return data || null;
  } catch (error) {
    console.warn('[WORKSPACE_CREATE][PROFILE_UPDATE_FAILED]', {
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
    const workspaceName = normalizeText(body?.workspaceName || body?.name || body?.bandName || body?.teamName);
    const supportWhatsapp = normalizeText(body?.supportWhatsapp || body?.whatsapp || body?.phone);
    const primaryColor = normalizeHexColor(body?.primaryColor || body?.brandColor);
    const timezone = normalizeText(body?.timezone) || 'America/Bahia';

    if (!workspaceName) {
      return NextResponse.json({ ok: false, error: 'Nome do workspace é obrigatório.' }, { status: 400 });
    }

    const bootstrap = await bootstrapWorkspaceForUser({
      supabase,
      userId: user.id,
      workspaceName,
      publicName: workspaceName,
      supportWhatsapp,
      primaryColor,
      timezone,
      source: 'authenticated_workspace_create_api',
    });

    const profile = await updateProfileWorkspaceSafe({
      supabase,
      user,
      workspaceId: bootstrap.workspace.id,
    });

    await resetOnboardingProgressForWorkspace({
      supabase,
      workspaceId: bootstrap.workspace.id,
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
      },
      profile,
      workspaceId: bootstrap.workspace.id,
      workspace: bootstrap.workspace,
      membership: bootstrap.ownerMembership,
      settings: bootstrap.settings,
      subscription: bootstrap.subscription,
      next: '/dashboard?onboarding=fresh-workspace',
    });
  } catch (error) {
    console.error('[WORKSPACE_CREATE][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao criar workspace.' },
      { status: error?.statusCode || 500 }
    );
  }
}
