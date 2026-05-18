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

async function ensureOnboardingProgressMarked({ supabase, workspaceId }) {
  const now = new Date().toISOString();
  const flowState = {
    onboarding_enabled: true,
    workspace_created_for_onboarding: true,
    onboarding_started_at: now,
    updatedAt: now,
  };

  const fullPayload = {
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
    flow_state: flowState,
    updated_at: now,
  };

  const fallbackPayload = {
    workspace_id: workspaceId,
    completed_at: null,
    flow_state: flowState,
    updated_at: now,
  };

  const minimalPayload = {
    workspace_id: workspaceId,
    flow_state: flowState,
  };

  const payloadAttempts = [fullPayload, fallbackPayload, minimalPayload];

  for (const payload of payloadAttempts) {
    const upsert = await supabase
      .from('workspace_onboarding_progress')
      .upsert(payload, { onConflict: 'workspace_id' });

    if (!upsert.error) return true;
    if (!isMissingColumnError(upsert.error)) break;
  }

  for (const payload of payloadAttempts) {
    const update = await supabase
      .from('workspace_onboarding_progress')
      .update(payload)
      .eq('workspace_id', workspaceId)
      .select('workspace_id')
      .maybeSingle();

    if (!update.error && update.data?.workspace_id) return true;
    if (update.error && !isMissingColumnError(update.error)) break;
  }

  for (const payload of payloadAttempts) {
    const insert = await supabase
      .from('workspace_onboarding_progress')
      .insert(payload);

    if (!insert.error) return true;
    if (!isMissingColumnError(insert.error)) {
      console.warn('[WORKSPACE_CREATE][ONBOARDING_MARK_INSERT_FAILED]', {
        message: insert.error?.message,
        code: insert.error?.code || null,
      });
      break;
    }
  }

  console.warn('[WORKSPACE_CREATE][ONBOARDING_MARK_FAILED]', { workspaceId });
  return false;
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

    const onboardingMarked = await ensureOnboardingProgressMarked({
      supabase,
      workspaceId: bootstrap.workspace.id,
    });

    const response = NextResponse.json({
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
      onboardingMarked,
      next: '/dashboard?onboarding=fresh-workspace',
    });

    const cookieOptions = {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    };

    response.cookies.set('workspace_id', bootstrap.workspace.id, cookieOptions);
    response.cookies.set('current_workspace_id', bootstrap.workspace.id, cookieOptions);
    response.cookies.set('harmonics_workspace_id', bootstrap.workspace.id, cookieOptions);

    return response;
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
