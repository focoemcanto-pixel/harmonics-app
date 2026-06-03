function normalizeStatusKey(status) {
  return String(status || '').trim().toLowerCase();
}

export function normalizeFinanceStatus(status) {
  const raw = normalizeStatusKey(status);

  if (['paid', 'pago', 'confirmed', 'confirmado', 'quitado'].includes(raw)) return 'paid';
  if (['partial', 'parcial'].includes(raw)) return 'partial';
  if (
    [
      'pending',
      'pendente',
      'em_analise',
      'em análise',
      'analysis',
      'analyzing',
      'pending_admin_validation',
      'admin_review',
      'pending_confirmation',
      'aguardando_validacao',
      'aguardando validação',
      'pendente_validacao',
    ].includes(raw)
  ) {
    return 'pending';
  }
  if (['cancelled', 'cancelado', 'canceled', 'rejected', 'rejeitado'].includes(raw)) return 'cancelled';

  return raw || 'pending';
}

export function isConfirmedPayment(status) {
  const normalized = normalizeFinanceStatus(status);
  return normalized === 'paid';
}

export function toMoneyNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  const normalized = raw
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateEventFinance({ agreedAmount, payments = [] }) {
  const normalizedAgreedAmount = Math.max(toMoneyNumber(agreedAmount), 0);
  const safePayments = Array.isArray(payments) ? payments : [];

  const paidAmount = safePayments.reduce((acc, payment) => {
    if (!isConfirmedPayment(payment?.status)) return acc;
    return acc + Math.max(toMoneyNumber(payment?.amount), 0);
  }, 0);

  const openAmount = Math.max(normalizedAgreedAmount - paidAmount, 0);

  let paymentStatus = 'pending';
  if (normalizedAgreedAmount <= 0) paymentStatus = 'pending';
  else if (paidAmount <= 0) paymentStatus = 'pending';
  else if (paidAmount < normalizedAgreedAmount) paymentStatus = 'partial';
  else paymentStatus = 'paid';

  return {
    agreedAmount: normalizedAgreedAmount,
    paidAmount,
    openAmount,
    paymentStatus,
  };
}

export async function syncEventFinanceSnapshot({ supabase, eventId, precontractId = null }) {
  const normalizedEventId = String(eventId || '').trim();
  if (!supabase || !normalizedEventId) return null;

  const [eventRes, preByEventRes, preByIdRes, paymentsRes] = await Promise.all([
    supabase
      .from('events')
      .select('id, agreed_amount')
      .eq('id', normalizedEventId)
      .maybeSingle(),
    supabase
      .from('precontracts')
      .select('id, agreed_amount')
      .eq('event_id', normalizedEventId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    precontractId
      ? supabase
          .from('precontracts')
          .select('id, agreed_amount')
          .eq('id', precontractId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('payments').select('amount, status').eq('event_id', normalizedEventId),
  ]);

  if (eventRes.error) throw eventRes.error;
  if (preByEventRes.error) throw preByEventRes.error;
  if (preByIdRes.error) throw preByIdRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const precontract = preByIdRes.data || preByEventRes.data || null;
  const event = eventRes.data || null;

  const precontractAgreed = toMoneyNumber(precontract?.agreed_amount);
  const eventAgreed = toMoneyNumber(event?.agreed_amount);
  const agreedAmount = precontractAgreed > 0 ? precontractAgreed : eventAgreed > 0 ? eventAgreed : 0;

  const summary = calculateEventFinance({
    agreedAmount,
    payments: paymentsRes.data || [],
  });

  const payload = {
    agreed_amount: summary.agreedAmount,
    paid_amount: summary.paidAmount,
    open_amount: summary.openAmount,
    payment_status: summary.paymentStatus,
  };

  const { error: updateError } = await supabase.from('events').update(payload).eq('id', normalizedEventId);
  if (updateError) throw updateError;

  return {
    eventId: normalizedEventId,
    precontractId: precontract?.id || null,
    ...summary,
  };
}
