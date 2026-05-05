import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentAutomationWorkspaceSettings } from '@/lib/automation/get-workspace';
import { ensureDefaultAutomations } from '@/lib/automation/ensure-defaults';
import { requireAdmin } from '@/lib/api/require-admin';

function asUuidOrNull(value) {
  const raw = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)
    ? raw
    : null;
}

function scopeWorkspace(query, workspaceId) {
  return workspaceId ? query.eq('workspace_id', workspaceId) : query;
}

export async function GET(request) {
  const supabaseAdmin = getSupabaseAdmin();

  const auth = await requireAdmin({
    supabase: supabaseAdmin,
    request,
    logPrefix: '[AUTOMATION_TEMPLATES][GET]',
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const workspace = await getCurrentAutomationWorkspaceSettings({ supabase: supabaseAdmin, request });
    const workspaceId = asUuidOrNull(workspace?.id);

    if (workspaceId) {
      await ensureDefaultAutomations(workspaceId);
    }

    const baseQuery = supabaseAdmin
      .from('message_templates')
      .select('id, workspace_id, key, name, channel, recipient_type, body, is_active, created_at, updated_at')
      .order('updated_at', { ascending: false });

    const { data, error } = await scopeWorkspace(baseQuery, workspaceId);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      templates: data || [],
      workspace_debug: {
        workspaceId,
        rawWorkspaceId: workspace?.id || null,
        source: workspace?.source || null,
        migrationMode: !workspaceId,
      },
    });
  } catch (error) {
    console.error('[GET /api/automation/templates] Erro:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const supabaseAdmin = getSupabaseAdmin();

  const auth = await requireAdmin({
    supabase: supabaseAdmin,
    request,
    logPrefix: '[AUTOMATION_TEMPLATES][POST]',
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const body = await request.json();

    const { name, key, body: messageBody, recipient_type } = body;

    if (!name || !key || !messageBody || !recipient_type) {
      return NextResponse.json(
        { ok: false, error: 'Campos obrigatórios: name, key, body, recipient_type' },
        { status: 400 }
      );
    }

    const workspace = await getCurrentAutomationWorkspaceSettings({ supabase: supabaseAdmin, request });
    const workspaceId = asUuidOrNull(workspace?.id);

    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: 'Workspace de automação não resolvido. Configure workspace_settings antes de criar templates.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('message_templates')
      .insert({
        workspace_id: workspaceId,
        name,
        key,
        channel: body.channel || 'whatsapp',
        recipient_type,
        body: messageBody,
        is_active: body.is_active !== undefined ? body.is_active : true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, template: data }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/automation/templates] Erro:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
