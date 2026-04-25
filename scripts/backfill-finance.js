#!/usr/bin/env node
import { getSupabaseAdmin } from '../lib/supabase-admin.js';
import { syncEventFinanceSnapshot, toMoneyNumber } from '../lib/finance/event-finance.js';

async function main() {
  const supabase = getSupabaseAdmin();

  const { data: precontracts, error: precontractsError } = await supabase
    .from('precontracts')
    .select('id, event_id, agreed_amount');
  if (precontractsError) throw precontractsError;

  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, agreed_amount');
  if (eventsError) throw eventsError;

  const eventById = new Map((events || []).map((event) => [String(event.id), event]));

  for (const precontract of precontracts || []) {
    const precontractAgreed = toMoneyNumber(precontract?.agreed_amount);
    if (precontractAgreed > 0) continue;

    const event = eventById.get(String(precontract?.event_id || '')) || null;
    const eventAgreed = toMoneyNumber(event?.agreed_amount);

    if (eventAgreed > 0) {
      const { error: updateError } = await supabase
        .from('precontracts')
        .update({
          agreed_amount: eventAgreed,
          remaining_amount: eventAgreed,
        })
        .eq('id', precontract.id);
      if (updateError) throw updateError;

      console.log('[FINANCE_BACKFILL][UPDATED]', {
        target: 'precontracts',
        precontractId: precontract.id,
        agreed_amount: eventAgreed,
      });
    } else {
      console.log('[FINANCE_BACKFILL][MISSING_AMOUNT]', {
        target: 'precontracts',
        precontractId: precontract.id,
        eventId: precontract?.event_id || null,
      });
    }
  }

  const { data: allPrecontracts, error: allPrecontractsError } = await supabase
    .from('precontracts')
    .select('id, event_id, agreed_amount')
    .not('event_id', 'is', null);
  if (allPrecontractsError) throw allPrecontractsError;

  for (const precontract of allPrecontracts || []) {
    const eventId = String(precontract?.event_id || '').trim();
    if (!eventId) continue;

    const precontractAgreed = toMoneyNumber(precontract?.agreed_amount);

    if (precontractAgreed > 0) {
      const { error: eventUpdateError } = await supabase
        .from('events')
        .update({ agreed_amount: precontractAgreed })
        .eq('id', eventId);
      if (eventUpdateError) throw eventUpdateError;

      console.log('[FINANCE_BACKFILL][UPDATED]', {
        target: 'events',
        eventId,
        precontractId: precontract.id,
        agreed_amount: precontractAgreed,
      });
    } else {
      console.log('[FINANCE_BACKFILL][MISSING_AMOUNT]', {
        target: 'events',
        eventId,
        precontractId: precontract.id,
      });
    }

    await syncEventFinanceSnapshot({
      supabase,
      eventId,
      precontractId: precontract.id,
    });
  }
}

main().catch((error) => {
  console.error('[FINANCE_BACKFILL][ERROR]', {
    message: error?.message || String(error),
  });
  process.exit(1);
});
