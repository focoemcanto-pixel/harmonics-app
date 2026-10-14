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
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : null;
}

const BUSINESS_TYPES = new Set(['banda', 'orquestra', 'grupo_vocal', 'dj', 'musico_solo', 'ministerio', 'produtora', 'outro']);

function mergeSettings(existingSettings, patch) {
  const current = existingSettings && typeof existingSettings === 'object' ? existingSettings : {};

  return {
    ...current,
    onboarding: {
      ...(current.onboarding || {}),
      completed: true,
      essentials_completed: true,
      completed_at: new Date().toISOString(),
      source: 'onboarding_complete_api',
    },
    profile: {
      ...(current.profile || {}),
      ...(patch.responsibleName ? { responsible_name: patch.responsibleName } : {}),
      ...(patch.city ? { city: patch.city } : {}),
      ...(patch.businessType ? { business_type: patch.businessType } : {}),
    },
    branding: {
      ...(current.branding || {}),
      ...(patch.primaryColor ? { primary_color: patch.primaryColor } : {}),
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
        ...(payload.primaryColor ? { primary_color: payload.primaryColor } : {}),
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
    const responsibleName = normalizeText(body?.responsibleName || body?.ownerName);
    const city = normalizeText(body?.city);
    const businessTypeRaw = String(body?.businessType || '').trim().toLowerCase();
    const businessType = BUSINESS_TYPES.has(businessTypeRaw) ? businessTypeRaw : null;

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
        responsibleName,
        city,
        businessType,
      },
    });

    const completionTimestamp = new Date().toISOString();
    const { data: existingProgress } = await supabase
      .from('workspace_onboarding_progress')
      .select('flow_state')
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();
    const previousFlowState = existingProgress?.flow_state && typeof existingProgress.flow_state === 'object'
      ? existingProgress.flow_state
      : {};

    await supabase
      .from('workspace_onboarding_progress')
      .upsert({
        workspace_id: auth.workspaceId,
        workspace_configured: true,
        // Passo essencial concluído; o checklist contextual continua (completed_at só quando
        // o checklist termina ou o usuário o oculta).
        flow_state: {
          ...previousFlowState,
          onboarding_enabled: true,
          essentials_completed: true,
          profile: { responsible_name: responsibleName, city, business_type: businessType },
          updatedAt: completionTimestamp,
        },
        updated_at: completionTimestamp,
      }, { onConflict: 'workspace_id' })
      .then?.(() => null);

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
      next: '/dashboard?onboarding=ready',
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
