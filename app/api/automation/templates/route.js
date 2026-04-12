import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDefaultWorkspace } from '@/lib/automation/get-workspace';

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const workspace = await getDefaultWorkspace();

    const query = supabaseAdmin
      .from('message_templates')
      .select('id, workspace_id, key, name, channel, recipient_type, body, is_active, created_at, updated_at')
      .eq('workspace_id', workspace.id)
      .order('updated_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ ok: true, templates: data || [] });
  } catch (error) {
    console.error('[GET /api/automation/templates] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const { name, key, body: messageBody, recipient_type } = body;

    if (!name || !key || !messageBody || !recipient_type) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: name, key, body, recipient_type' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const workspace = await getDefaultWorkspace();

    const { data, error } = await supabaseAdmin
      .from('message_templates')
      .insert({
        workspace_id: workspace.id,
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
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
