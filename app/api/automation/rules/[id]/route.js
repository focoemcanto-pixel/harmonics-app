import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('automation_rules')
      .select(
        `id, workspace_id, key, name, event_type, recipient_type,
         template_id, channel_id, days_before, days_after, send_time,
         is_active, created_at, updated_at,
         message_templates!template_id(id, name, key),
         whatsapp_channels!channel_id(id, name)`
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: 'Regra não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, rule: data });
  } catch (error) {
    console.error('[GET /api/automation/rules/:id] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const supabaseAdmin = getSupabaseAdmin();

    const { data: existing, error: findError } = await supabaseAdmin
      .from('automation_rules')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (findError) throw findError;

    if (!existing) {
      return NextResponse.json(
        { error: 'Regra não encontrada' },
        { status: 404 }
      );
    }

    const allowed = [
      'key', 'name', 'event_type', 'recipient_type',
      'template_id', 'channel_id', 'days_before', 'days_after',
      'send_time', 'is_active',
    ];

    const updates = {};
    for (const field of allowed) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('automation_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, rule: data });
  } catch (error) {
    console.error('[PATCH /api/automation/rules/:id] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
