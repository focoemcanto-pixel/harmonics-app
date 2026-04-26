import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import {
  calculateEventFinance,
  syncEventFinanceSnapshot,
  toMoneyNumber,
} from '@/lib/finance/event-finance';
import { createPaymentScheduleForPrecontract } from '@/lib/finance/create-payment-schedule';

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
  'signal_amount',
  'remaining_amount',
  'payment_method',
  'signal_due_date',
  'balance_due_date',
  'card_due_date',
  'payment_card',
  'notes',
  'status',
  'public_token',
  'generated_link',
  'custom_contract_enabled',
  'custom_contract_content',
  'custom_contract_rich_html',
  'contract_template_id',
  'contract_mode',
  'event_id',
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

function normalizePrecontractFinancialPayload(payload = {}) {
  const agreedAmount = Math.max(toMoneyNumber(payload?.agreed_amount), 0);
  const signalAmount = Math.max(toMoneyNumber(payload?.signal_amount), 0);
  const remainingAmount = Math.max(toMoneyNumber(payload?.remaining_amount) || agreedAmount - signalAmount, 0);

  return {
    ...payload,
    agreed_amount: agreedAmount,
    signal_amount: signalAmount,
    remaining_amount: remainingAmount,
    payment_method: payload?.payment_method || null,
    signal_due_date: payload?.signal_due_date || null,
    balance_due_date: payload?.balance_due_date || null,
    card_due_date: payload?.card_due_date || null,
    payment_card: payload?.payment_card === true,
  };
}

async function syncEventSnapshotFromPrecontract({ supabase, precontract }) {
  const eventId = String(precontract?.event_id || '').trim();
  if (!eventId) return;

  const { data: eventRow, error: eventError } = await supabase
    .from('events')
    .select('id, paid_amount')
    .eq('id', eventId)
    .maybeSingle();
  if (eventError) throw eventError;

  const agreedAmount = Math.max(toMoneyNumber(precontract?.agreed_amount), 0);
  const paidAmount = Math.max(toMoneyNumber(eventRow?.paid_amount), 0);
  const summary = calculateEventFinance({
    agreedAmount,
    payments: [{ amount: paidAmount, status: paidAmount > 0 ? 'paid' : 'pending' }],
  });

  const eventUpdatePayload = {
  agreed_amount: agreedAmount,
  paid_amount: paidAmount,
  open_amount: summary.openAmount,
  payment_status: summary.paymentStatus,
  signal_due_date: precontract?.signal_due_date || null,
  balance_due_date: precontract?.balance_due_date || null,
  card_due_date: precontract?.card_due_date || null,
};

const precontractEventType = String(precontract?.event_type || '').trim();

if (precontractEventType) {
  eventUpdatePayload.event_type = precontractEventType;
}

const { error: updateEventError } = await supabase
  .from('events')
  .update(eventUpdatePayload)
  .eq('id', eventId);

  if (updateEventError) throw updateEventError;

  await createPaymentScheduleForPrecontract({
    supabase,
    eventId,
    precontract,
  });

  await syncEventFinanceSnapshot({
    supabase,
    eventId,
    precontractId: precontract?.id || null,
  });
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

    const writePayload = normalizePrecontractFinancialPayload({
      ...payload,
      public_token: body?.public_token || null,
      generated_link: body?.generated_link || null,
    });

    let data = null;
    if (id) {
      const response = await supabase
        .from('precontracts')
        .update(writePayload)
        .eq('id', id)
        .select(PRECONTRACT_SELECT_FIELDS)
        .single();
      if (response.error) throw response.error;
      data = response.data;
    } else {
      const response = await supabase
        .from('precontracts')
        .insert([writePayload])
        .select(PRECONTRACT_SELECT_FIELDS)
        .single();
      if (response.error) throw response.error;
      data = response.data;
    }

    if (data?.event_id) {
      await syncEventSnapshotFromPrecontract({
        supabase,
        precontract: data,
      });
    }

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
