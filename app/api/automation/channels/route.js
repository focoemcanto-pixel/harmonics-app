import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDefaultWorkspaceSettings } from '@/lib/automation/get-workspace';
import { validateChannelConfig } from '@/lib/whatsapp/channel-config';

const SAVE_CHANNELS_AUDIT_VERSION = '2026-04-12-audit-v2';

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const workspace = await getDefaultWorkspaceSettings();

    const query = supabaseAdmin
      .from('whatsapp_channels')
      .select(
        'id, name, provider, api_url, instance_id, sender_number, admin_alert_number, is_active, is_default, created_at'
      )
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    const channels = (data || []).map((channel) => {
      const validation = validateChannelConfig(channel);
      return {
        ...channel,
        has_api_key: Boolean(channel.api_key),
        status: validation.isValid ? 'valid' : 'invalid',
        status_reason: validation.isValid ? null : `Faltando: ${validation.missing.join(', ')}`,
        api_key: undefined,
      };
    });

    return NextResponse.json({ ok: true, channels });
  } catch (error) {
    console.error('[GET /api/automation/channels] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const required = ['name', 'provider', 'api_url', 'api_key', 'instance_id'];
    const missing = required.filter((field) => !String(body[field] || '').trim());

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Campos obrigatórios: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    const { name } = body;

    if (String(body.provider).trim().toLowerCase() !== 'wasender') {
      return NextResponse.json(
        { error: 'Apenas provider wasender é suportado no momento' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const workspace = await getDefaultWorkspaceSettings();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'missing';

    const isDefault = body.is_default === true;

    const insertPayload = {
      workspace_id: workspace.id,
      name: String(name).trim(),
      provider: String(body.provider || 'wasender').trim().toLowerCase(),
      api_url: body.api_url ? String(body.api_url).trim() : null,
      api_key: body.api_key ? String(body.api_key).trim() : null,
      instance_id: body.instance_id ? String(body.instance_id).trim() : null,
      sender_number: body.sender_number ? String(body.sender_number).trim() : null,
      admin_alert_number: body.admin_alert_number ? String(body.admin_alert_number).trim() : null,
      is_active: body.is_active !== undefined ? body.is_active : true,
      is_default: isDefault,
    };

    console.info('[POST /api/automation/channels] save-audit:start', {
      audit_version: SAVE_CHANNELS_AUDIT_VERSION,
      deploy_sha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'unknown',
      supabase_url: supabaseUrl,
      workspace_found: !!workspace,
      resolved_workspace_settings_id: workspace?.id || null,
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
        .eq('workspace_id', workspace.id);
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
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
