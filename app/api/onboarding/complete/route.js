import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function normalizePhone(value) {
  const phone = String(value || '').replace(/\D+/g, '');
  return phone || null;
}

function normalizeColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#10b981';
}

function mergeSettings(existingSettings, patch) {
  const current = existingSettings && typeof existingSettings === 'object' ? existingSettings : {};

  return {
    ...current,
    onboarding: {
      ...(current.onboarding || {}),
      completed: true,
      completed_at: new Date().toISOString(),
      source: 'onboarding_complete_api',
    },
    branding: {
      ...(current.branding || {}),
      primary_color: patch.primaryColor,
    },
  };
}

async function getOrCreateWorkspaceSettings({ supabase, workspaceId, workspace, payload }) {
  const { data: existing, error: existingError } = await supabase
    .from('workspace_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const merged = mergeSettings(existing.settings, payload);

    const { data, error } = await supabase
      .from('workspace_settings')
      .update({
        public_name: payload.publicName,
        company_name: payload.publicName,
        support_whatsapp: payload.supportWhatsapp,
        admin_whatsapp: payload.supportWhatsapp,
        primary_color: payload.primaryColor,
        settings: merged,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('workspace_settings')
    .insert({
      workspace_id: workspaceId,
      workspace_key: workspace?.slug || workspace?.key || null,
      company_name: payload.publicName,
      public_name: payload.publicName,
      support_whatsapp: payload.supportWhatsapp,
      admin_whatsapp: payload.supportWhatsapp,
      default_timezone: 'America/Bahia',
      client_panel_base_url: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || null,
      is_active: true,
      primary_color: payload.primaryColor,
      contract_mode: 'internal',
      settings: mergeSettings({}, payload),
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      allowedRoles: ['owner', 'admin', 'administrador'],
      logPrefix: '[ONBOARDING_COMPLETE_API]',
    });

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error || 'Acesso não autorizado.' },
        { status: auth.status || 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const publicName = normalizeText(body?.publicName || body?.companyName || body?.name || auth.workspace?.name);
    const supportWhatsapp = normalizePhone(body?.supportWhatsapp || body?.whatsapp || body?.phone);
    const primaryColor = normalizeColor(body?.primaryColor);

    if (!publicName) {
      return NextResponse.json({ ok: false, error: 'Nome público é obrigatório.' }, { status: 400 });
    }

    const settings = await getOrCreateWorkspaceSettings({
      supabase,
      workspaceId: auth.workspaceId,
      workspace: auth.workspace,
      payload: {
        publicName,
        supportWhatsapp,
        primaryColor,
      },
    });

    // Mantém o nome do workspace alinhado com a identidade pública quando possível.
    await supabase
      .from('workspaces')
      .update({ name: publicName })
      .eq('id', auth.workspaceId)
      .then?.(() => null);

    return NextResponse.json({
      ok: true,
      workspaceId: auth.workspaceId,
      settings,
      next: '/eventos',
    });
  } catch (error) {
    console.error('[ONBOARDING_COMPLETE_API][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao concluir onboarding.' },
      { status: error?.statusCode || 500 }
    );
  }
}
