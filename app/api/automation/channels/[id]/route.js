import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDefaultWorkspace } from '@/lib/automation/get-workspace';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const supabaseAdmin = getSupabaseAdmin();

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

    if (updates.is_default === true) {
      const workspace = await getDefaultWorkspace();
      const wsId = existing.workspace_id || workspace.id;
      if (wsId) {
        await supabaseAdmin
          .from('whatsapp_channels')
          .update({ is_default: false })
          .eq('workspace_id', wsId)
          .neq('id', id);
      }
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
