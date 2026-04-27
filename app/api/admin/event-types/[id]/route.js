import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';

const SELECT_FIELDS = 'id, name, slug, description, is_active, sort_order, color, icon, default_contract_template_id, created_at, updated_at';
const ALLOWED_PATCH_FIELDS = [
  'name',
  'slug',
  'description',
  'is_active',
  'sort_order',
  'color',
  'icon',
  'default_contract_template_id',
];

function buildPatchPayload(body = {}) {
  return ALLOWED_PATCH_FIELDS.reduce((acc, field) => {
    if (!Object.prototype.hasOwnProperty.call(body, field)) return acc;

    if (['name', 'slug', 'description'].includes(field)) {
      acc[field] = String(body[field] ?? '').trim();
      return acc;
    }

    if (field === 'is_active') {
      acc[field] = body[field] !== false;
      return acc;
    }

    if (field === 'sort_order') {
      acc[field] = Number.parseInt(String(body[field] ?? '0'), 10) || 0;
      return acc;
    }

    if (field === 'default_contract_template_id') {
      acc[field] = String(body[field] ?? '').trim() || null;
      return acc;
    }

    if (['color', 'icon'].includes(field)) {
      acc[field] = String(body[field] ?? '').trim() || null;
      return acc;
    }

    return acc;
  }, {});
}

export async function PATCH(request, context) {
  const supabaseAdmin = getSupabaseAdmin();

  const auth = await requireAdmin({
    supabase: supabaseAdmin,
    request,
    logPrefix: '[EVENT_TYPES_API][PATCH]',
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const resolvedParams = await context?.params;
    const id = String(resolvedParams?.id || '').trim();

    if (!id) {
      return NextResponse.json({ ok: false, error: 'ID do tipo de evento é obrigatório.' }, { status: 400 });
    }

    const body = await request.json();
    const payload = buildPatchPayload(body);

    if (!Object.keys(payload).length) {
      return NextResponse.json({ ok: false, error: 'Nenhum campo permitido para atualizar.' }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('event_types')
      .update(payload)
      .eq('id', id)
      .select('id')
      .single();

    if (updateError) throw updateError;

    const { data: eventType, error: fetchError } = await supabaseAdmin
      .from('event_types')
      .select(SELECT_FIELDS)
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json({ ok: true, eventType });
  } catch (error) {
    console.error('[EVENT_TYPES_API][PATCH][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno ao atualizar tipo de evento.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request, context) {
  const supabaseAdmin = getSupabaseAdmin();

  const auth = await requireAdmin({
    supabase: supabaseAdmin,
    request,
    logPrefix: '[EVENT_TYPES_API][DELETE]',
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const resolvedParams = await context?.params;
    const id = String(resolvedParams?.id || '').trim();

    if (!id) {
      return NextResponse.json({ ok: false, error: 'ID do tipo de evento é obrigatório.' }, { status: 400 });
    }

    const { data: eventType, error: fetchEventTypeError } = await supabaseAdmin
      .from('event_types')
      .select('id, name')
      .eq('id', id)
      .single();

    if (fetchEventTypeError) throw fetchEventTypeError;

    const [eventsById, eventsByName, precontractsById, precontractsByName] = await Promise.all([
      supabaseAdmin.from('events').select('id', { head: true, count: 'exact' }).eq('event_type_id', id),
      supabaseAdmin.from('events').select('id', { head: true, count: 'exact' }).eq('event_type', eventType.name),
      supabaseAdmin.from('precontracts').select('id', { head: true, count: 'exact' }).eq('event_type_id', id),
      supabaseAdmin.from('precontracts').select('id', { head: true, count: 'exact' }).eq('event_type', eventType.name),
    ]);

    const checkErrors = [eventsById.error, eventsByName.error, precontractsById.error, precontractsByName.error]
      .filter(Boolean);
    if (checkErrors.length > 0) throw checkErrors[0];

    const totalLinks = Number(eventsById.count || 0)
      + Number(eventsByName.count || 0)
      + Number(precontractsById.count || 0)
      + Number(precontractsByName.count || 0);

    if (totalLinks > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Este tipo já está em uso. Inative para não aparecer em novos pré-contratos.',
          links: {
            eventsById: Number(eventsById.count || 0),
            eventsByName: Number(eventsByName.count || 0),
            precontractsById: Number(precontractsById.count || 0),
            precontractsByName: Number(precontractsByName.count || 0),
          },
        },
        { status: 409 },
      );
    }

    const { data: deletedRows, error: deleteError } = await supabaseAdmin
      .from('event_types')
      .delete()
      .eq('id', id)
      .select('id');

    if (deleteError) throw deleteError;

    if (!deletedRows?.length) {
      return NextResponse.json(
        { ok: false, error: 'Nenhum registro foi excluído.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (error) {
    console.error('[EVENT_TYPES_API][DELETE][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno ao excluir tipo de evento.' },
      { status: 500 },
    );
  }
}
