import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { executeAutomationEvent } from '@/lib/automation/execute-automation-event';
import { requireAdminServer } from '@/lib/api/require-admin-server';

export const dynamic = 'force-dynamic';

function daysBetween(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

export async function POST(request) {
  const cronSecret = String(process.env.AUTOMATION_CRON_SECRET || '').trim();
  const auth = String(request.headers.get('x-automation-secret') || '').trim();
  const isCronAllowed = cronSecret && auth && auth === cronSecret;
  if (!isCronAllowed) {
    const adminGuard = await requireAdminServer(request);
    if (!adminGuard.ok) return adminGuard.response;
  }

  const supabase = getSupabaseAdmin();
  const { data: precontracts, error } = await supabase
    .from('precontracts')
    .select('id, created_at, event_date, status, raw_payload')
    .neq('status', 'signed')
    .limit(1000);
  if (error) throw error;

  const ids = (precontracts || []).map((p) => p.id);
  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, precontract_id, status, raw_payload')
    .in('precontract_id', ids.length ? ids : ['']);

  const contractByPre = new Map((contracts || []).map((c) => [c.precontract_id, c]));
  const now = new Date();
  const results = [];

  for (const pre of (precontracts || [])) {
    const contract = contractByPre.get(pre.id);
    if (String(contract?.status || pre?.status || '').toLowerCase() === 'signed') continue;

    const raw = { ...(pre?.raw_payload || {}), ...(contract?.raw_payload || {}) };
    const createdAt = pre?.created_at ? new Date(pre.created_at) : null;
    const eventDate = pre?.event_date ? new Date(`${pre.event_date}T12:00:00`) : null;
    const should15d = createdAt && daysBetween(now, createdAt) >= 15 && !raw.unsigned_alert_15d_sent_at;
    const dte = eventDate ? daysBetween(eventDate, now) : null;
    const should30dEvent = dte !== null && dte >= 0 && dte <= 30 && !raw.unsigned_alert_30d_event_sent_at;
    if (!should15d && !should30dEvent) continue;

    const dispatch = await executeAutomationEvent({ eventType: 'contract_signed_admin', entityId: pre.id }).catch(() => null);
    const updatedRaw = { ...(contract?.raw_payload || {}) };
    if (should15d) updatedRaw.unsigned_alert_15d_sent_at = now.toISOString();
    if (should30dEvent) updatedRaw.unsigned_alert_30d_event_sent_at = now.toISOString();
    if (contract?.id) await supabase.from('contracts').update({ raw_payload: updatedRaw }).eq('id', contract.id);

    results.push({ precontractId: pre.id, should15d, should30dEvent, sent: !!dispatch?.ok });
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
