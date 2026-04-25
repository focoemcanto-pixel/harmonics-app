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


function includesCertificacaoText(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

  return normalized.includes('certificacao');
}

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

export async function PATCH(request, context) {
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
    const resolvedParams = await context?.params;
    const id = String(resolvedParams?.id || '').trim();
    console.info('[CONTRACT_TEMPLATE_API][ROUTE_PARAMS]', {
      rawParams: resolvedParams,
      id,
    });
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

    const { error: updateError } = await supabaseAdmin
      .from('contract_templates')
      .update(payload)
      .eq('id', id)
      .select('id')
      .single();

    if (updateError) throw updateError;

    const { data: finalTemplate, error: fetchFinalError } = await supabaseAdmin
      .from('contract_templates')
      .select(SELECT_FIELDS)
      .eq('id', id)
      .single();

    if (fetchFinalError) throw fetchFinalError;

    console.info('[TEMPLATE_PATCH_FINAL]', {
      id: finalTemplate?.id || id,
      contentLen: String(finalTemplate?.content || '').length,
      sourceRichLen: String(finalTemplate?.source_rich_html || '').length,
      updatedAt: finalTemplate?.updated_at || null,
      includesCertificacao:
        includesCertificacaoText(finalTemplate?.source_rich_html) ||
        includesCertificacaoText(finalTemplate?.content),
    });

    return NextResponse.json({ ok: true, template: finalTemplate });
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

export async function DELETE(request, context) {
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
    const resolvedParams = await context?.params;
    const id = String(resolvedParams?.id || '').trim();
    console.info('[CONTRACT_TEMPLATE_API][ROUTE_PARAMS]', {
      rawParams: resolvedParams,
      id,
    });
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
