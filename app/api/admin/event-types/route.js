import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';

const SELECT_FIELDS = 'id, name, slug, description, is_active, sort_order, color, icon, default_contract_template_id, created_at, updated_at';

export async function GET(request) {
  const supabaseAdmin = getSupabaseAdmin();

  const auth = await requireAdmin({
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
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ ok: true, eventTypes: data || [] });
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

  const auth = await requireAdmin({
    supabase: supabaseAdmin,
    request,
    logPrefix: '[EVENT_TYPES_API][POST]',
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const body = await request.json();

    const payload = {
      name: String(body?.name || '').trim(),
      slug: String(body?.slug || '').trim(),
      description: String(body?.description || '').trim(),
      is_active: body?.is_active !== false,
      sort_order: Number.parseInt(String(body?.sort_order ?? '0'), 10) || 0,
      color: String(body?.color || '').trim() || null,
      icon: String(body?.icon || '').trim() || null,
      default_contract_template_id: String(body?.default_contract_template_id || '').trim() || null,
    };

    if (!payload.name || !payload.slug) {
      return NextResponse.json(
        { ok: false, error: 'Campos obrigatórios: name e slug.' },
        { status: 400 },
      );
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('event_types')
      .insert(payload)
      .select('id')
      .single();

    if (error) throw error;

    const { data: eventType, error: fetchError } = await supabaseAdmin
      .from('event_types')
      .select(SELECT_FIELDS)
      .eq('id', inserted.id)
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
      { status: 500 },
    );
  }
}
