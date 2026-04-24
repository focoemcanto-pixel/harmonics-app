import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';

const PRECONTRACT_SELECT_FIELDS = [
  'id',
  'created_at',
  'client_name',
  'client_email',
  'client_phone',
  'event_type',
  'event_type_id',
  'event_date',
  'event_time',
  'duration_min',
  'location_name',
  'location_address',
  'formation',
  'instruments',
  'has_sound',
  'reception_hours',
  'has_transport',
  'base_amount',
  'add_reception',
  'add_sound',
  'add_transport',
  'agreed_amount',
  'notes',
  'status',
  'public_token',
  'generated_link',
  'custom_contract_enabled',
  'custom_contract_content',
  'custom_contract_rich_html',
  'contract_template_id',
  'contract_mode',
].join(', ');

function parseDateOnly(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const [year, month, day] = raw.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function getTodayStart() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[PRECONTRACTS_API]' });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.error }, { status: auth.status || 401 });
    }

    const body = await request.json();
    const id = String(body?.id || '').trim();
    const payload = body?.payload && typeof body.payload === 'object' ? body.payload : {};
    const eventDateRaw = payload?.event_date;
    const eventDate = parseDateOnly(eventDateRaw);
    const todayStart = getTodayStart();

    if (!eventDateRaw || !eventDate) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Data do evento inválida. Informe uma data válida para continuar.',
        },
        { status: 400 }
      );
    }

    let existingItem = null;
    if (id) {
      const { data, error } = await supabase
        .from('precontracts')
        .select('id, event_date')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      existingItem = data || null;
    }

    const existingDate = parseDateOnly(existingItem?.event_date);
    const isTryingPastDate = eventDate < todayStart;
    const isLegacyUnchangedPastEdit =
      Boolean(id) &&
      existingDate &&
      existingDate < todayStart &&
      String(existingItem?.event_date || '') === String(eventDateRaw || '');

    if (isTryingPastDate && !isLegacyUnchangedPastEdit) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Data do evento inválida. Não é permitido salvar datas passadas.',
        },
        { status: 400 }
      );
    }

    const writePayload = {
      ...payload,
      public_token: body?.public_token || null,
      generated_link: body?.generated_link || null,
    };

    if (id) {
      const { data, error } = await supabase
        .from('precontracts')
        .update(writePayload)
        .eq('id', id)
        .select(PRECONTRACT_SELECT_FIELDS)
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, data });
    }

    const { data, error } = await supabase
      .from('precontracts')
      .insert([writePayload])
      .select(PRECONTRACT_SELECT_FIELDS)
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error('[PRECONTRACTS_API][POST][ERROR]', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'Erro inesperado ao salvar pré-contrato.',
      },
      { status: 500 }
    );
  }
}
