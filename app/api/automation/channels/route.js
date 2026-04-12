import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDefaultWorkspace } from '@/lib/automation/get-workspace';

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const workspace = await getDefaultWorkspace();

    const query = supabaseAdmin
      .from('whatsapp_channels')
      .select(
        'id, name, provider, api_url, instance_id, sender_number, admin_alert_number, is_active, is_default, created_at'
      )
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ ok: true, channels: data || [] });
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

    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Campo obrigatório: name' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const workspace = await getDefaultWorkspace();

    const isDefault = body.is_default === true;

    if (isDefault) {
      await supabaseAdmin
        .from('whatsapp_channels')
        .update({ is_default: false })
        .eq('workspace_id', workspace.id);
    }

    const { data, error } = await supabaseAdmin
      .from('whatsapp_channels')
      .insert({
        workspace_id: workspace.id,
        name,
        provider: body.provider || 'wasender',
        api_url: body.api_url || null,
        api_key: body.api_key || null,
        instance_id: body.instance_id || null,
        sender_number: body.sender_number || null,
        admin_alert_number: body.admin_alert_number || null,
        is_active: body.is_active !== undefined ? body.is_active : true,
        is_default: isDefault,
      })
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
