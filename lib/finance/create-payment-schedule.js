import { toMoneyNumber } from '@/lib/finance/event-finance';

export async function createPaymentScheduleForPrecontract({ supabase, eventId, precontract }) {
  const normalizedEventId = String(eventId || '').trim();
  const precontractId = String(precontract?.id || '').trim() || null;
  const workspaceId = String(precontract?.workspace_id || '').trim() || null;

  if (!supabase || !normalizedEventId || !precontractId) {
    return { created: 0, skipped: true, reason: 'missing_params' };
  }

  const agreedAmount = Math.max(toMoneyNumber(precontract?.agreed_amount), 0);
  if (agreedAmount <= 0) {
    return { created: 0, skipped: true, reason: 'agreed_amount_not_positive' };
  }

  const { data: existingPayments, error: existingError } = await supabase
    .from('payments')
    .select('id')
    .or(`event_id.eq.${normalizedEventId},precontract_id.eq.${precontractId}`)
    .limit(1);

  if (existingError) throw existingError;
  if ((existingPayments || []).length > 0) {
    return { created: 0, skipped: true, reason: 'payments_already_exist' };
  }

  const signalAmount = Math.max(toMoneyNumber(precontract?.signal_amount), 0);
  const remainingAmount = Math.max(
    toMoneyNumber(precontract?.remaining_amount) || agreedAmount - signalAmount,
    0
  );

  const basePayload = {
    workspace_id: workspaceId,
    event_id: normalizedEventId,
    precontract_id: precontractId,
    payment_method: precontract?.payment_method || null,
    status: 'pending',
  };

  const rows = [];
  if (signalAmount > 0) {
    rows.push({
      ...basePayload,
      amount: signalAmount,
      due_date: precontract?.signal_due_date || null,
      notes: 'Sinal',
    });

    if (remainingAmount > 0) {
      rows.push({
        ...basePayload,
        amount: remainingAmount,
        due_date: precontract?.balance_due_date || null,
        notes: 'Saldo final',
      });
    }
  } else {
    rows.push({
      ...basePayload,
      amount: agreedAmount,
      due_date: precontract?.balance_due_date || precontract?.card_due_date || null,
      notes: 'Pagamento único',
    });
  }

  const { error: insertError } = await supabase.from('payments').insert(rows);
  if (insertError) throw insertError;

  return {
    created: rows.length,
    skipped: false,
    reason: null,
  };
}

function toIsoDateOnly(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function subtractDays(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - Number(days || 0));
  return date.toISOString().slice(0, 10);
}

export async function createDefaultPaymentScheduleForEvent({
  supabase,
  eventId,
  agreedAmount,
  eventDate,
  paymentMethod = null,
  workspaceId = null,
}) {
  const normalizedEventId = String(eventId || '').trim();
  const normalizedWorkspaceId = String(workspaceId || '').trim() || null;
  const eventDateIso = toIsoDateOnly(eventDate);
  const total = Math.max(toMoneyNumber(agreedAmount), 0);

  if (!supabase || !normalizedEventId) {
    return { created: 0, skipped: true, reason: 'missing_params' };
  }
  if (!eventDateIso) {
    return { created: 0, skipped: true, reason: 'missing_event_date' };
  }
  if (total <= 0) {
    return { created: 0, skipped: true, reason: 'agreed_amount_not_positive' };
  }

  let resolvedWorkspaceId = normalizedWorkspaceId;
  if (!resolvedWorkspaceId) {
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('workspace_id')
      .eq('id', normalizedEventId)
      .maybeSingle();
    if (eventError) throw eventError;
    resolvedWorkspaceId = String(event?.workspace_id || '').trim() || null;
  }

  if (!resolvedWorkspaceId) {
    return { created: 0, skipped: true, reason: 'missing_workspace_id' };
  }

  const { data: existingPayments, error: existingError } = await supabase
    .from('payments')
    .select('id')
    .eq('event_id', normalizedEventId)
    .limit(1);
  if (existingError) throw existingError;
  if ((existingPayments || []).length > 0) {
    return { created: 0, skipped: true, reason: 'payments_already_exist' };
  }

  const firstAmount = Number((total / 2).toFixed(2));
  const secondAmount = Number((total - firstAmount).toFixed(2));
  const rows = [
    {
      workspace_id: resolvedWorkspaceId,
      event_id: normalizedEventId,
      precontract_id: null,
      payment_method: paymentMethod || null,
      status: 'pending',
      amount: firstAmount,
      due_date: subtractDays(eventDateIso, 14),
      notes: 'Primeira parcela - 50%',
    },
    {
      workspace_id: resolvedWorkspaceId,
      event_id: normalizedEventId,
      precontract_id: null,
      payment_method: paymentMethod || null,
      status: 'pending',
      amount: secondAmount,
      due_date: subtractDays(eventDateIso, 2),
      notes: 'Saldo final - 50%',
    },
  ];

  const { error: insertError } = await supabase.from('payments').insert(rows);
  if (insertError) throw insertError;

  return { created: rows.length, skipped: false, reason: null };
}
