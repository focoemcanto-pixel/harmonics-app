import { extractBucketAndPathFromProofUrl } from '@/lib/payments/payment-proof-storage';

function normalizeId(value) {
  return String(value || '').trim();
}

function isRejectedStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  return ['rejected', 'rejeitado', 'cancelado', 'cancelled', 'canceled'].includes(raw);
}

function isSettledPaymentStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  return ['confirmed', 'confirmado', 'paid', 'pago'].includes(raw);
}

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function bestEffortDeleteProofFiles(supabase, payments = [], logPrefix) {
  for (const payment of payments) {
    const parsed = extractBucketAndPathFromProofUrl(payment?.proof_file_url);
    if (!parsed.bucket || !parsed.path) continue;

    try {
      const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.path]);
      if (error) {
        console.warn(`${logPrefix}[PROOF_DELETE_WARN]`, {
          paymentId: payment.id,
          bucket: parsed.bucket,
          path: parsed.path,
          message: error.message,
        });
      }
    } catch (error) {
      console.warn(`${logPrefix}[PROOF_DELETE_WARN]`, {
        paymentId: payment.id,
        bucket: parsed.bucket,
        path: parsed.path,
        message: error?.message || 'proof_delete_failed',
      });
    }
  }
}

async function recalculateEventsFinancials({ supabase, eventIds = [], logPrefix }) {
  const normalizedEventIds = Array.from(new Set(eventIds.map(normalizeId).filter(Boolean)));
  if (normalizedEventIds.length === 0) return [];

  const [eventsRes, paymentsRes] = await Promise.all([
    supabase.from('events').select('id, agreed_amount').in('id', normalizedEventIds),
    supabase.from('payments').select('event_id, amount, status').in('event_id', normalizedEventIds),
  ]);

  if (eventsRes.error) throw eventsRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const paymentsByEventId = new Map();
  for (const item of paymentsRes.data || []) {
    const key = normalizeId(item?.event_id);
    if (!key) continue;
    if (!paymentsByEventId.has(key)) paymentsByEventId.set(key, []);
    paymentsByEventId.get(key).push(item);
  }

  const updates = [];
  for (const eventRow of eventsRes.data || []) {
    const eventId = normalizeId(eventRow?.id);
    if (!eventId) continue;

    const agreedAmount = toNumber(eventRow?.agreed_amount);
    const paidAmount = (paymentsByEventId.get(eventId) || []).reduce((acc, payment) => {
      if (isRejectedStatus(payment?.status)) return acc;
      if (!isSettledPaymentStatus(payment?.status)) return acc;
      return acc + toNumber(payment?.amount);
    }, 0);
    const openAmount = Math.max(agreedAmount - paidAmount, 0);
    const paymentStatus =
      openAmount <= 0 && agreedAmount > 0 ? 'Pago' : paidAmount > 0 ? 'Parcial' : 'Pendente';

    const payload = {
      paid_amount: paidAmount,
      open_amount: openAmount,
      payment_status: paymentStatus,
    };

    const { error: updateError } = await supabase.from('events').update(payload).eq('id', eventId);
    if (updateError) throw updateError;

    updates.push({ id: eventId, ...payload });
  }

  console.info(`${logPrefix}[EVENTS_RECALCULATED]`, {
    affectedEvents: updates.length,
    eventIds: updates.map((item) => item.id),
  });

  return updates;
}

export async function deletePaymentsByIds({ supabase, paymentIds = [], logPrefix = '[PAYMENTS_DELETE_API]' }) {
  const normalizedIds = Array.from(new Set(paymentIds.map(normalizeId).filter(Boolean)));

  if (normalizedIds.length === 0) {
    return {
      success: false,
      ok: false,
      affected: 0,
      ids: [],
      eventUpdates: [],
      message: 'Selecione ao menos um pagamento para excluir.',
    };
  }

  const { data: existingPayments, error: existingError } = await supabase
    .from('payments')
    .select('id, event_id, proof_file_url')
    .in('id', normalizedIds);

  if (existingError) throw existingError;

  if (!existingPayments || existingPayments.length === 0) {
    return {
      success: false,
      ok: false,
      affected: 0,
      ids: [],
      eventUpdates: [],
      message: 'Nenhum pagamento correspondente foi encontrado para exclusão.',
    };
  }

  await bestEffortDeleteProofFiles(supabase, existingPayments, logPrefix);

  const { data: deletedRows, error: deleteError } = await supabase
    .from('payments')
    .delete()
    .in('id', normalizedIds)
    .select('id, event_id');

  if (deleteError) throw deleteError;

  const deletedIds = (deletedRows || []).map((item) => normalizeId(item?.id)).filter(Boolean);
  const affected = deletedIds.length;

  if (affected === 0) {
    return {
      success: false,
      ok: false,
      affected: 0,
      ids: [],
      eventUpdates: [],
      message: 'Nenhum pagamento foi excluído.',
    };
  }

  const affectedEventIds = Array.from(
    new Set((deletedRows || []).map((row) => normalizeId(row?.event_id)).filter(Boolean))
  );

  const eventUpdates = await recalculateEventsFinancials({
    supabase,
    eventIds: affectedEventIds,
    logPrefix,
  });

  return {
    success: true,
    ok: true,
    affected,
    ids: deletedIds,
    eventUpdates,
    message:
      affected === 1
        ? 'Pagamento excluído com sucesso.'
        : `${affected} pagamento(s) excluído(s) com sucesso.`,
  };
}
