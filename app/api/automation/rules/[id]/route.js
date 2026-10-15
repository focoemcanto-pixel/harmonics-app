import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';

export async function PATCH(request, context) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[PATCH /api/automation/rules/[id]]' });
  if (!guard.ok) return guard.response;

  try {
    const routeParams = await context?.params;
    const { id } = routeParams || {};

    if (!id) {
      return NextResponse.json(
        { error: 'ID é obrigatório' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const allowed = [
      'key', 'name', 'event_type', 'recipient_type',
      'template_id', 'channel_id', 'days_before', 'days_after', 'delay_hours',
      'send_time', 'is_active',
    ];

    const updates = {};
    for (const field of allowed) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Nenhum campo válido para atualizar' },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const supabaseAdmin = guard.supabase;

    const { data, error } = await supabaseAdmin
      .from('automation_rules')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', guard.auth.workspaceId)
      .select()
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
    console.error('[PATCH /api/automation/rules/[id]] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
