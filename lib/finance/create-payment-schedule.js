import { toMoneyNumber } from '@/lib/finance/event-finance';

export async function createPaymentScheduleForPrecontract({ supabase, eventId, precontract }) {
  const normalizedEventId = String(eventId || '').trim();
  const precontractId = String(precontract?.id || '').trim() || null;

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
