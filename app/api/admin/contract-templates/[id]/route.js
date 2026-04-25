import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';

const SELECT_FIELDS = 'id, name, slug, description, content, source_text, source_rich_html, is_active, is_default, created_at, updated_at';
const ALLOWED_PATCH_FIELDS = [
  'name',
  'slug',
  'description',
  'content',
  'source_text',
  'source_rich_html',
  'is_active',
  'is_default',
];

function buildPatchPayload(body = {}) {
  return ALLOWED_PATCH_FIELDS.reduce((acc, field) => {
    if (!Object.prototype.hasOwnProperty.call(body, field)) return acc;

    if (['name', 'slug', 'description', 'content', 'source_text', 'source_rich_html'].includes(field)) {
      acc[field] = String(body[field] ?? '');
      return acc;
    }

    if (['is_active', 'is_default'].includes(field)) {
      acc[field] = Boolean(body[field]);
    }

    return acc;
  }, {});
}

export async function PATCH(request, { params }) {
  const supabaseAdmin = getSupabaseAdmin();

  const auth = await requireAdmin({
    supabase: supabaseAdmin,
    request,
    logPrefix: '[CONTRACT_TEMPLATE_API][PATCH]',
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const id = String(params?.id || '').trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: 'ID do template é obrigatório.' }, { status: 400 });
    }

    const body = await request.json();
    const payload = buildPatchPayload(body);

    if (!Object.keys(payload).length) {
      return NextResponse.json({ ok: false, error: 'Nenhum campo permitido para atualizar.' }, { status: 400 });
    }

    console.info('[CONTRACT_TEMPLATE_API][PATCH]', {
      id,
      source_rich_html_len: String(payload.source_rich_html || '').length,
      source_text_len: String(payload.source_text || '').length,
      content_len: String(payload.content || '').length,
      is_active: payload.is_active,
      is_default: payload.is_default,
    });

    if (payload.is_default === true) {
      const { error: clearBeforeError } = await supabaseAdmin
        .from('contract_templates')
        .update({ is_default: false })
        .neq('id', id);

      if (clearBeforeError) throw clearBeforeError;
    }

    const { data: updated, error } = await supabaseAdmin
      .from('contract_templates')
      .update(payload)
      .eq('id', id)
      .select(SELECT_FIELDS)
      .single();

    if (error) throw error;

    if (payload.is_default === true) {
      const { error: clearAfterError } = await supabaseAdmin
        .from('contract_templates')
        .update({ is_default: false })
        .neq('id', id);

      if (clearAfterError) throw clearAfterError;
    }

    return NextResponse.json({ ok: true, template: updated });
  } catch (error) {
    console.error('[CONTRACT_TEMPLATE_API][PATCH][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno ao atualizar template.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  const supabaseAdmin = getSupabaseAdmin();

  const auth = await requireAdmin({
    supabase: supabaseAdmin,
    request,
    logPrefix: '[CONTRACT_TEMPLATE_API][DELETE]',
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const id = String(params?.id || '').trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: 'ID do template é obrigatório.' }, { status: 400 });
    }

    const [eventTypesUsage, precontractsUsage] = await Promise.all([
      supabaseAdmin
        .from('event_types')
        .select('id, name, slug')
        .eq('default_contract_template_id', id),
      supabaseAdmin
        .from('precontracts')
        .select('id, client_name, event_date, status')
        .eq('contract_template_id', id),
    ]);

    if (eventTypesUsage.error) throw eventTypesUsage.error;
    if (precontractsUsage.error) throw precontractsUsage.error;

    const linkedEventTypes = eventTypesUsage.data || [];
    const linkedPrecontracts = precontractsUsage.data || [];

    if (linkedEventTypes.length > 0 || linkedPrecontracts.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Template vinculado a tipos de evento/pré-contratos. Desvincule antes de excluir.',
          links: {
            event_types: linkedEventTypes,
            precontracts: linkedPrecontracts,
          },
        },
        { status: 409 },
      );
    }

    const { data: deletedRows, error } = await supabaseAdmin
      .from('contract_templates')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) throw error;

    if (!deletedRows?.length) {
      return NextResponse.json(
        { ok: false, error: 'Nenhum registro foi excluído.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (error) {
    console.error('[CONTRACT_TEMPLATE_API][DELETE][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno ao excluir template.' },
      { status: 500 },
    );
  }
}
