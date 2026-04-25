import { extractBucketAndPathFromProofUrl } from '@/lib/payments/payment-proof-storage';
import { syncEventFinanceSnapshot } from '@/lib/finance/event-finance';

function normalizeId(value) {
  return String(value || '').trim();
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

  const updates = [];
  for (const eventId of normalizedEventIds) {
    const summary = await syncEventFinanceSnapshot({
      supabase,
      eventId,
    });

    updates.push({
      id: eventId,
      paid_amount: summary?.paidAmount || 0,
      open_amount: summary?.openAmount || 0,
      payment_status: summary?.paymentStatus || 'pending',
    });
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
