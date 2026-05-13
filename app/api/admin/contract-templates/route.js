import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';
import { emitWorkspaceEvent } from '@/lib/workspace-events/emitWorkspaceEvent';
import { WORKSPACE_EVENT_TYPES } from '@/lib/workspace-events/eventTypes';

const SELECT_FIELDS = 'id, workspace_id, name, slug, description, content, source_text, source_rich_html, is_active, is_default, created_at, updated_at';

export async function GET(request) {
  const supabaseAdmin = getSupabaseAdmin();
  const auth = await requireWorkspaceAdmin({ supabase: supabaseAdmin, request, logPrefix: '[CONTRACT_TEMPLATE_API][GET]' });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('contract_templates')
      .select(SELECT_FIELDS)
      .eq('workspace_id', auth.workspaceId)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ ok: true, templates: data || [], workspaceId: auth.workspaceId });
  } catch (error) {
    console.error('[CONTRACT_TEMPLATE_API][GET][ERROR]', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Erro interno ao listar templates.' }, { status: 500 });
  }
}

export async function POST(request) {
  const supabaseAdmin = getSupabaseAdmin();
  const auth = await requireWorkspaceAdmin({ supabase: supabaseAdmin, request, logPrefix: '[CONTRACT_TEMPLATE_API][POST]' });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const body = await request.json();
    const payload = {
      workspace_id: auth.workspaceId,
      name: String(body?.name || '').trim(),
      slug: String(body?.slug || '').trim(),
      description: String(body?.description || '').trim(),
      content: String(body?.content || ''),
      source_text: String(body?.source_text || ''),
      source_rich_html: String(body?.source_rich_html || ''),
      is_active: body?.is_active !== false,
      is_default: body?.is_default === true,
    };

    if (!payload.name || !payload.slug) {
      return NextResponse.json({ ok: false, error: 'Campos obrigatórios: name e slug.' }, { status: 400 });
    }

    if (payload.is_default) {
      const { error: clearError } = await supabaseAdmin
        .from('contract_templates')
        .update({ is_default: false })
        .eq('workspace_id', auth.workspaceId)
        .eq('is_default', true);
      if (clearError) throw clearError;
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('contract_templates')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;

    await emitWorkspaceEvent({
      supabase: supabaseAdmin,
      workspaceId: auth.workspaceId,
      type: WORKSPACE_EVENT_TYPES.TEMPLATE_CREATED,
      metadata: { templateId: inserted.id, slug: payload.slug, isDefault: payload.is_default },
    });

    const { data: template, error: fetchError } = await supabaseAdmin
      .from('contract_templates')
      .select(SELECT_FIELDS)
      .eq('id', inserted.id)
      .eq('workspace_id', auth.workspaceId)
      .single();
    if (fetchError) throw fetchError;

    return NextResponse.json({ ok: true, template }, { status: 201 });
  } catch (error) {
    console.error('[CONTRACT_TEMPLATE_API][POST][ERROR]', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Erro interno ao criar template.' }, { status: 500 });
  }
}
