import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';
import { emitWorkspaceEvent } from '@/lib/workspace-events/emitWorkspaceEvent';
import { WORKSPACE_EVENT_TYPES } from '@/lib/workspace-events/eventTypes';

const SELECT_FIELDS = 'id, workspace_id, name, slug, description, content, source_text, source_rich_html, is_active, is_default, created_at, updated_at';
const LEGACY_SELECT_FIELDS = 'id, name, slug, description, content, source_text, source_rich_html, is_active, is_default, created_at, updated_at';

function isMissingWorkspaceColumnError(error) {
  const message = String(error?.message || error?.details || '').toLowerCase();
  return message.includes('workspace_id') && (message.includes('does not exist') || message.includes('could not find'));
}

function withWorkspaceId(template, workspaceId) {
  if (!template) return template;
  return { ...template, workspace_id: template.workspace_id || workspaceId || null };
}

async function listTemplatesWithWorkspaceFallback(supabaseAdmin, workspaceId) {
  const scoped = await supabaseAdmin
    .from('contract_templates')
    .select(SELECT_FIELDS)
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (!scoped.error) {
    return {
      data: scoped.data || [],
      legacyMode: false,
    };
  }

  if (!isMissingWorkspaceColumnError(scoped.error)) {
    throw scoped.error;
  }

  console.warn('[CONTRACT_TEMPLATE_API][GET][LEGACY_SCHEMA]', {
    message: scoped.error?.message,
  });

  const legacy = await supabaseAdmin
    .from('contract_templates')
    .select(LEGACY_SELECT_FIELDS)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (legacy.error) throw legacy.error;

  return {
    data: (legacy.data || []).map((template) => withWorkspaceId(template, workspaceId)),
    legacyMode: true,
  };
}

export async function GET(request) {
  const supabaseAdmin = getSupabaseAdmin();
  const auth = await requireWorkspaceAdmin({ supabase: supabaseAdmin, request, logPrefix: '[CONTRACT_TEMPLATE_API][GET]' });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const result = await listTemplatesWithWorkspaceFallback(supabaseAdmin, auth.workspaceId);

    return NextResponse.json({
      ok: true,
      templates: result.data || [],
      workspaceId: auth.workspaceId,
      legacySchema: result.legacyMode,
      warning: result.legacyMode
        ? 'A tabela contract_templates ainda não possui workspace_id. Aplique a migration de workspace scoping para isolar templates por workspace.'
        : null,
    });
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
    const basePayload = {
      name: String(body?.name || '').trim(),
      slug: String(body?.slug || '').trim(),
      description: String(body?.description || '').trim(),
      content: String(body?.content || ''),
      source_text: String(body?.source_text || ''),
      source_rich_html: String(body?.source_rich_html || ''),
      is_active: body?.is_active !== false,
      is_default: body?.is_default === true,
    };

    const payload = {
      workspace_id: auth.workspaceId,
      ...basePayload,
    };

    if (!payload.name || !payload.slug) {
      return NextResponse.json({ ok: false, error: 'Campos obrigatórios: name e slug.' }, { status: 400 });
    }

    if (payload.is_default) {
      const clearScoped = await supabaseAdmin
        .from('contract_templates')
        .update({ is_default: false })
        .eq('workspace_id', auth.workspaceId)
        .eq('is_default', true);

      if (clearScoped.error && !isMissingWorkspaceColumnError(clearScoped.error)) {
        throw clearScoped.error;
      }

      if (clearScoped.error && isMissingWorkspaceColumnError(clearScoped.error)) {
        const clearLegacy = await supabaseAdmin
          .from('contract_templates')
          .update({ is_default: false })
          .eq('is_default', true);
        if (clearLegacy.error) throw clearLegacy.error;
      }
    }

    let insertedResult = await supabaseAdmin
      .from('contract_templates')
      .insert(payload)
      .select('id')
      .single();

    let legacyMode = false;

    if (insertedResult.error && isMissingWorkspaceColumnError(insertedResult.error)) {
      legacyMode = true;
      insertedResult = await supabaseAdmin
        .from('contract_templates')
        .insert(basePayload)
        .select('id')
        .single();
    }

    if (insertedResult.error) throw insertedResult.error;

    const inserted = insertedResult.data;

    await emitWorkspaceEvent({
      supabase: supabaseAdmin,
      workspaceId: auth.workspaceId,
      type: WORKSPACE_EVENT_TYPES.TEMPLATE_CREATED,
      metadata: { templateId: inserted.id, slug: payload.slug, isDefault: payload.is_default, legacySchema: legacyMode },
    });

    let fetchResult = await supabaseAdmin
      .from('contract_templates')
      .select(SELECT_FIELDS)
      .eq('id', inserted.id)
      .eq('workspace_id', auth.workspaceId)
      .single();

    if (fetchResult.error && isMissingWorkspaceColumnError(fetchResult.error)) {
      fetchResult = await supabaseAdmin
        .from('contract_templates')
        .select(LEGACY_SELECT_FIELDS)
        .eq('id', inserted.id)
        .single();
    }

    if (fetchResult.error) throw fetchResult.error;

    return NextResponse.json({
      ok: true,
      template: withWorkspaceId(fetchResult.data, auth.workspaceId),
      legacySchema: legacyMode,
    }, { status: 201 });
  } catch (error) {
    console.error('[CONTRACT_TEMPLATE_API][POST][ERROR]', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Erro interno ao criar template.' }, { status: 500 });
  }
}
