import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';

const SELECT_FIELDS = 'id, name, slug, description, content, source_text, source_rich_html, is_active, is_default, created_at, updated_at';

export async function GET(request) {
  const supabaseAdmin = getSupabaseAdmin();

  const auth = await requireAdmin({
    supabase: supabaseAdmin,
    request,
    logPrefix: '[CONTRACT_TEMPLATE_API][GET]',
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('contract_templates')
      .select(SELECT_FIELDS)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ ok: true, templates: data || [] });
  } catch (error) {
    console.error('[CONTRACT_TEMPLATE_API][GET][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno ao listar templates.' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const supabaseAdmin = getSupabaseAdmin();

  const auth = await requireAdmin({
    supabase: supabaseAdmin,
    request,
    logPrefix: '[CONTRACT_TEMPLATE_API][POST]',
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
      content: String(body?.content || ''),
      source_text: String(body?.source_text || ''),
      source_rich_html: String(body?.source_rich_html || ''),
      is_active: body?.is_active !== false,
      is_default: body?.is_default === true,
    };

    if (!payload.name || !payload.slug) {
      return NextResponse.json(
        { ok: false, error: 'Campos obrigatórios: name e slug.' },
        { status: 400 },
      );
    }

    if (payload.is_default) {
      const { error: clearBeforeError } = await supabaseAdmin
        .from('contract_templates')
        .update({ is_default: false })
        .eq('is_default', true);

      if (clearBeforeError) throw clearBeforeError;
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('contract_templates')
      .insert(payload)
      .select(SELECT_FIELDS)
      .single();

    if (error) throw error;

    if (payload.is_default) {
      const { error: clearAfterError } = await supabaseAdmin
        .from('contract_templates')
        .update({ is_default: false })
        .neq('id', inserted.id);

      if (clearAfterError) throw clearAfterError;
    }

    return NextResponse.json({ ok: true, template: inserted }, { status: 201 });
  } catch (error) {
    console.error('[CONTRACT_TEMPLATE_API][POST][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno ao criar template.' },
      { status: 500 },
    );
  }
}
