import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDefaultWorkspace } from '@/lib/automation/get-workspace';

const SAVE_CHANNELS_AUDIT_VERSION = '2026-04-12-audit-v2';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const supabaseAdmin = getSupabaseAdmin();
    const workspace = await getDefaultWorkspace();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'missing';

    const { data: existing, error: findError } = await supabaseAdmin
      .from('whatsapp_channels')
      .select('id, workspace_id')
      .eq('id', id)
      .maybeSingle();

    if (findError) throw findError;

    if (!existing) {
      return NextResponse.json(
        { error: 'Canal não encontrado' },
        { status: 404 }
      );
    }

    const allowed = [
      'name',
      'provider',
      'api_url',
      'api_key',
      'instance_id',
      'sender_number',
      'admin_alert_number',
      'is_active',
      'is_default',
    ];

    const updates = {};
    for (const field of allowed) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    updates.workspace_id = workspace.id;

    console.info('[PATCH /api/automation/channels/:id] save-audit:start', {
      audit_version: SAVE_CHANNELS_AUDIT_VERSION,
      deploy_sha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'unknown',
      supabase_url: supabaseUrl,
      channel_id: id,
      workspace_found: !!workspace,
      existing_workspace_id: existing.workspace_id || null,
      resolved_workspace_id: workspace?.id || null,
      operation: 'update',
      payload: {
        ...updates,
        api_key: updates.api_key ? '[REDACTED]' : updates.api_key,
      },
    });

    if (updates.is_default === true) {
      await supabaseAdmin
        .from('whatsapp_channels')
        .update({ is_default: false })
        .eq('workspace_id', workspace.id)
        .neq('id', id);
    }

    const { data, error } = await supabaseAdmin
      .from('whatsapp_channels')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, channel: data });
  } catch (error) {
    console.error('[PATCH /api/automation/channels/:id] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
