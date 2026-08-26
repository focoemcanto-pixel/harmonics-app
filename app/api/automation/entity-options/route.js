import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const INVITE_TYPES = new Set(['invite_member', 'schedule_no_response_member']);
const CONTRACT_TYPES = new Set([
  'contract_signed_client',
  'contract_signed_admin',
  'contract_review_released_client',
  'contract_signature_reminder_client',
]);

function fmtDate(value) {
  if (!value) return 'Sem data';
  const [y, m, d] = String(value).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(value);
}

function clean(value) {
  return String(value || '').trim();
}

export async function GET(request) {
  const supabase = getSupabaseAdmin();
  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[AUTOMATION_ENTITY_OPTIONS]' });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
    }

    const url = new URL(request.url);
    const eventType = clean(url.searchParams.get('eventType'));
    if (!eventType) {
      return NextResponse.json({ ok: false, error: 'eventType é obrigatório' }, { status: 400 });
    }

    const workspaceId = clean(auth.workspaceId || auth.workspace?.id || '');
    const options = [];

    if (INVITE_TYPES.has(eventType)) {
      let query = supabase
        .from('invites')
        .select(`
          id, status, created_at, event_id, contact_id,
          contact:contacts(id, name, phone),
          event:events(id, workspace_id, client_name, event_date, event_time)
        `)
        .neq('status', 'removed')
        .order('created_at', { ascending: false })
        .limit(120);
      const { data, error } = await query;
      if (error) throw error;
      for (const row of data || []) {
        if (workspaceId && clean(row?.event?.workspace_id) !== workspaceId) continue;
        const memberName = row?.contact?.name || 'Membro';
        const eventName = row?.event?.client_name || 'Evento';
        options.push({
          id: row.id,
          kind: 'invite',
          label: `${memberName} • ${eventName} • ${fmtDate(row?.event?.event_date)}`,
          subtitle: row?.status ? `Convite: ${row.status}` : null,
        });
      }
    } else if (CONTRACT_TYPES.has(eventType)) {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          id, status, created_at, event_id, precontract_id,
          event:events(id, workspace_id, client_name, event_date, event_time),
          precontract:precontracts(id, client_name, event_date, event_time)
        `)
        .order('created_at', { ascending: false })
        .limit(120);
      if (error) throw error;
      for (const row of data || []) {
        if (workspaceId && clean(row?.event?.workspace_id) !== workspaceId) continue;
        const eventName = row?.event?.client_name || row?.precontract?.client_name || 'Cliente';
        const date = row?.event?.event_date || row?.precontract?.event_date;
        let entityId = row.id;
        if (eventType === 'contract_signed_admin' || eventType === 'contract_review_released_client') {
          entityId = row.precontract_id || row?.precontract?.id || row.id;
        }
        options.push({
          id: entityId,
          kind: 'contract',
          label: `${eventName} • ${fmtDate(date)}`,
          subtitle: row?.status ? `Contrato: ${row.status}` : null,
          contractId: row.id,
        });
      }
    } else {
      const { data, error } = await supabase
        .from('events')
        .select('id, workspace_id, client_name, event_date, event_time, status')
        .eq('workspace_id', workspaceId)
        .order('event_date', { ascending: false })
        .limit(150);
      if (error) throw error;
      for (const row of data || []) {
        options.push({
          id: row.id,
          kind: 'event',
          label: `${row.client_name || 'Evento'} • ${fmtDate(row.event_date)}`,
          subtitle: row.status || null,
        });
      }
    }

    return NextResponse.json({ ok: true, eventType, options });
  } catch (error) {
    console.error('[AUTOMATION_ENTITY_OPTIONS][ERROR]', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Falha ao listar entidades para teste.' }, { status: 500 });
  }
}
