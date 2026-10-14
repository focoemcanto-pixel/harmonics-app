import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';

export async function PATCH(request, context) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[PATCH /api/automation/templates/[id]]' });
  if (!guard.ok) return guard.response;

  try {
    const routeParams = await context?.params;
    const { id } = routeParams || {};
    const body = await request.json();

    const supabaseAdmin = guard.supabase;
    const workspaceId = guard.auth.workspaceId;

    const { data: existing, error: findError } = await supabaseAdmin
      .from('message_templates')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (findError) throw findError;

    if (!existing) {
      return NextResponse.json(
        { error: 'Template não encontrado' },
        { status: 404 }
      );
    }

    const allowed = ['name', 'key', 'channel', 'recipient_type', 'body', 'is_active'];
    const updates = {};
    for (const field of allowed) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('message_templates')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, template: data });
  } catch (error) {
    console.error('[PATCH /api/automation/templates/:id] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
