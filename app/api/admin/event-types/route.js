import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';
import { emitWorkspaceEvent } from '@/lib/workspace-events/emitWorkspaceEvent';
import { WORKSPACE_EVENT_TYPES } from '@/lib/workspace-events/eventTypes';

const SELECT_FIELDS = 'id, workspace_id, name, slug, description, is_active, sort_order, color, icon, default_contract_template_id, created_at, updated_at';

function normalizeSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function workspaceSlugSuffix(workspaceId) {
  return String(workspaceId || '').trim().slice(0, 8).toLowerCase();
}

function scopeSlugForWorkspace(slug, workspaceId) {
  const baseSlug = normalizeSlug(slug);
  const suffix = workspaceSlugSuffix(workspaceId);
  if (!baseSlug || !suffix) return baseSlug;

  const scopedSuffix = `-${suffix}`;
  return baseSlug.endsWith(scopedSuffix) ? baseSlug : `${baseSlug}${scopedSuffix}`;
}

async function assertTemplateBelongsToWorkspace(supabaseAdmin, templateId, workspaceId) {
  const id = String(templateId || '').trim();
  if (!id) return null;

  const { data, error } = await supabaseAdmin
    .from('contract_templates')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    const notFound = new Error('Template padrão não pertence ao workspace atual ou não existe.');
    notFound.statusCode = 400;
    throw notFound;
  }

  return id;
}

function isDuplicateSlugError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  return code === '23505' || message.includes('event_types_slug_key') || details.includes('event_types_slug_key');
}

export async function GET(request) {
  const supabaseAdmin = getSupabaseAdmin();

  const auth = await requireWorkspaceAdmin({
    supabase: supabaseAdmin,
    request,
    logPrefix: '[EVENT_TYPES_API][GET]',
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('event_types')
      .select(SELECT_FIELDS)
      .eq('workspace_id', auth.workspaceId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ ok: true, eventTypes: data || [], workspaceId: auth.workspaceId });
  } catch (error) {
    console.error('[EVENT_TYPES_API][GET][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno ao listar tipos de evento.' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const supabaseAdmin = getSupabaseAdmin();

  const auth = await requireWorkspaceAdmin({
    supabase: supabaseAdmin,
    request,
    logPrefix: '[EVENT_TYPES_API][POST]',
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const body = await request.json();
    const name = String(body?.name || '').trim();
    const baseSlug = String(body?.slug || name).trim();
    const defaultTemplateId = await assertTemplateBelongsToWorkspace(
      supabaseAdmin,
      body?.default_contract_template_id,
      auth.workspaceId,
    );

    const payload = {
      workspace_id: auth.workspaceId,
      name,
      slug: scopeSlugForWorkspace(baseSlug, auth.workspaceId),
      description: String(body?.description || '').trim(),
      is_active: body?.is_active !== false,
      sort_order: Number.parseInt(String(body?.sort_order ?? '0'), 10) || 0,
      color: String(body?.color || '').trim() || null,
      icon: String(body?.icon || '').trim() || null,
      default_contract_template_id: defaultTemplateId,
    };

    if (!payload.name || !payload.slug) {
      return NextResponse.json(
        { ok: false, error: 'Campos obrigatórios: name e slug.' },
        { status: 400 },
      );
    }

    const existing = await supabaseAdmin
      .from('event_types')
      .select('id')
      .eq('workspace_id', auth.workspaceId)
      .eq('slug', payload.slug)
      .maybeSingle();

    if (existing.error) throw existing.error;
    if (existing.data?.id) {
      return NextResponse.json(
        { ok: false, error: 'Já existe um tipo de evento com este slug neste workspace.' },
        { status: 409 },
      );
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('event_types')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      if (isDuplicateSlugError(error)) {
        return NextResponse.json(
          { ok: false, error: 'Este slug já está em uso. Altere o slug e tente novamente.' },
          { status: 409 },
        );
      }
      throw error;
    }

    await emitWorkspaceEvent({
      supabase: supabaseAdmin,
      workspaceId: auth.workspaceId,
      type: WORKSPACE_EVENT_TYPES.EVENT_TYPE_CREATED,
      metadata: { eventTypeId: inserted.id, slug: payload.slug },
    });

    const { data: eventType, error: fetchError } = await supabaseAdmin
      .from('event_types')
      .select(SELECT_FIELDS)
      .eq('id', inserted.id)
      .eq('workspace_id', auth.workspaceId)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json({ ok: true, eventType }, { status: 201 });
  } catch (error) {
    console.error('[EVENT_TYPES_API][POST][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno ao criar tipo de evento.' },
      { status: error?.statusCode || 500 },
    );
  }
}
