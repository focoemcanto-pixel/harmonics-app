import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentAutomationWorkspaceSettings } from '@/lib/automation/get-workspace';
import { validateChannelConfig } from '@/lib/whatsapp/channel-config';
import { requireAdmin } from '@/lib/api/require-admin';

const SAVE_CHANNELS_AUDIT_VERSION = '2026-04-12-audit-v2';

function asUuidOrNull(value) {
  const raw = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)
    ? raw
    : null;
}

function scopeWorkspace(query, workspaceId) {
  return workspaceId ? query.eq('workspace_id', workspaceId) : query;
}

function normalizeAdminPhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  let digits = raw.replace(/[\s()\-]/g, '').replace(/\D/g, '');
  if (!digits) return null;
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`;
  }
  return digits;
}

async function requireChannelsAdmin(request, method) {
  const supabaseAdmin = getSupabaseAdmin();

  const auth = await requireAdmin({
    supabase: supabaseAdmin,
    request,
    logPrefix: `[AUTOMATION_CHANNELS][${method}]`,
  });

  return { supabaseAdmin, auth };
}

export async function GET(request) {
  const { supabaseAdmin, auth } = await requireChannelsAdmin(request, 'GET');

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status || 401 }
    );
  }

  try {
    const workspace = await getCurrentAutomationWorkspaceSettings({ supabase: supabaseAdmin, request });
    const workspaceId = asUuidOrNull(workspace?.id);

    const baseQuery = supabaseAdmin
      .from('whatsapp_channels')
      .select(
        'id, name, provider, api_url, instance_id, sender_number, admin_alert_number, is_active, is_default, created_at'
      )
      .order('created_at', { ascending: false });

    const { data, error } = await scopeWorkspace(baseQuery, workspaceId);

    if (error) throw error;

    const channels = (data || []).map((channel) => {
      const validation = validateChannelConfig(channel);
      return {
        ...channel,
        has_api_key: false,
        status: validation.isValid ? 'valid' : 'invalid',
        status_reason: validation.isValid ? null : `Faltando: ${validation.missing.join(', ')}`,
      };
    });

    return NextResponse.json({
      ok: true,
      channels,
      workspace_debug: {
        workspaceId,
        rawWorkspaceId: workspace?.id || null,
        source: workspace?.source || null,
        migrationMode: !workspaceId,
      },
    });
  } catch (error) {
    console.error('[GET /api/automation/channels] Erro:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const { supabaseAdmin, auth } = await requireChannelsAdmin(request, 'POST');

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status || 401 }
    );
  }

  try {
    const body = await request.json();

    const required = ['name', 'provider', 'api_url', 'api_key', 'instance_id'];
    const missing = required.filter((field) => !String(body[field] || '').trim());

    if (missing.length > 0) {
      return NextResponse.json(
        { ok: false, error: `Campos obrigatórios: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    const { name } = body;

    if (String(body.provider).trim().toLowerCase() !== 'wasender') {
      return NextResponse.json(
        { ok: false, error: 'Apenas provider wasender é suportado no momento' },
        { status: 400 }
      );
    }

    const workspace = await getCurrentAutomationWorkspaceSettings({ supabase: supabaseAdmin, request });
    const workspaceId = asUuidOrNull(workspace?.id);

    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: 'Workspace de automação não resolvido. Configure workspace_settings antes de criar canais.' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'missing';
    const isDefault = body.is_default === true;

    const insertPayload = {
      workspace_id: workspaceId,
      name: String(name).trim(),
      provider: String(body.provider || 'wasender').trim().toLowerCase(),
      api_url: body.api_url ? String(body.api_url).trim() : null,
      api_key: body.api_key ? String(body.api_key).trim() : null,
      instance_id: body.instance_id ? String(body.instance_id).trim() : null,
      sender_number: body.sender_number ? String(body.sender_number).trim() : null,
      admin_alert_number: normalizeAdminPhone(body.admin_alert_number),
      is_active: body.is_active !== undefined ? body.is_active : true,
      is_default: isDefault,
    };

    console.info('[POST /api/automation/channels] save-audit:start', {
      audit_version: SAVE_CHANNELS_AUDIT_VERSION,
      deploy_sha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'unknown',
      supabase_url: supabaseUrl,
      workspace_found: Boolean(workspaceId),
      resolved_workspace_settings_id: workspaceId,
      operation: 'insert',
      payload: {
        ...insertPayload,
        api_key: insertPayload.api_key ? '[REDACTED]' : null,
      },
    });

    if (isDefault) {
      await supabaseAdmin
        .from('whatsapp_channels')
        .update({ is_default: false })
        .eq('workspace_id', workspaceId);
    }

    const { data, error } = await supabaseAdmin
      .from('whatsapp_channels')
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, channel: data }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/automation/channels] Erro:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
