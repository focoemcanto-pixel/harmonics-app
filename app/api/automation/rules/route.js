import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDefaultWorkspace } from '@/lib/automation/get-workspace';

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const workspaceId = await getDefaultWorkspace();

    let query = supabaseAdmin
      .from('automation_rules')
      .select(
        `id, workspace_id, key, name, event_type, recipient_type,
         template_id, channel_id, days_before, days_after, send_time,
         is_active, created_at, updated_at,
         template:message_templates(id, name, key),
         channel:whatsapp_channels(id, name, provider)`
      )
      .order('updated_at', { ascending: false });

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ ok: true, rules: data || [] });
  } catch (error) {
    console.error('[GET /api/automation/rules] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const { key, name, event_type, recipient_type } = body;

    if (!key || !name || !event_type || !recipient_type) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: key, name, event_type, recipient_type' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const workspaceId = await getDefaultWorkspace();

    const { data, error } = await supabaseAdmin
      .from('automation_rules')
      .insert({
        workspace_id: workspaceId,
        key,
        name,
        event_type,
        recipient_type,
        template_id: body.template_id || null,
        channel_id: body.channel_id || null,
        days_before: body.days_before ?? null,
        days_after: body.days_after ?? null,
        send_time: body.send_time || null,
        is_active: body.is_active !== false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, rule: data }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/automation/rules] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
