import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_LIST_LIMIT = 100;
const EVENTS_SELECT_FIELDS =
  'id, workspace_id, created_at, client_name, event_type, event_date, event_time, duration_min, location_name, formation, instruments, has_sound, has_transport, reception_hours, whatsapp_name, whatsapp_phone, agreed_amount, paid_amount, open_amount, payment_status, status, has_antesala, antesala_enabled, antesala_requested_by_client, antesala_request_status, antesala_duration_minutes, antesala_price_increment, musician_cost, sound_cost, extra_transport_cost, other_cost, profit_amount, transport_price, cost_breakdown, costs_source';
const PRECONTRACTS_SELECT_FIELDS =
  'id, workspace_id, created_at, event_id, client_name, event_date, event_time, status, public_token';
const CONTRACTS_SELECT_FIELDS =
  'id, workspace_id, created_at, precontract_id, event_id, status, signed_at, pdf_url, doc_url, public_token';

function normalizeListLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(parsed), 1), 300);
}

function buildScaleSummaryByEvent(eventMusicians = []) {
  const summary = {};

  for (const item of eventMusicians || []) {
    const eventId = String(item?.event_id || '');
    if (!eventId) continue;

    const current = summary[eventId] || {
      totalMusicians: 0,
      confirmedMusicians: 0,
    };
    const status = String(item?.status || '').trim().toLowerCase();

    current.totalMusicians += 1;
    if (status === 'confirmed' || status === 'confirmado') {
      current.confirmedMusicians += 1;
    }

    summary[eventId] = current;
  }

  return summary;
}

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      moduleKey: 'eventos',
      actionKey: 'read',
      logPrefix: '[EVENTS_API][GET]',
      allowedRoles: ['owner', 'admin', 'operacional', 'editor', 'viewer'],
    });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.error || 'Acesso não autorizado.' }, { status: auth.status || 401 });
    }

    const workspaceId = auth.workspaceId;
    const { searchParams } = new URL(request.url);
    const limit = normalizeListLimit(searchParams.get('limit'));
    const scope = String(searchParams.get('scope') || 'all').trim().toLowerCase();

    const shouldLoadEvents = scope === 'all' || scope === 'events';
    const shouldLoadPrecontracts = scope === 'all' || scope === 'precontracts';
    const shouldLoadContracts = scope === 'all' || scope === 'contracts';

    let events = [];
    let scaleSummaryByEventId = {};
    let precontracts = [];
    let contracts = [];

    if (shouldLoadEvents) {
      const { data, error } = await supabase
        .from('events')
        .select(EVENTS_SELECT_FIELDS)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      events = data || [];

      const eventIds = events
        .map((item) => String(item?.id || '').trim())
        .filter(Boolean);

      if (eventIds.length > 0) {
        const { data: eventMusiciansData, error: eventMusiciansError } = await supabase
          .from('event_musicians')
          .select('event_id, status')
          .in('event_id', eventIds);

        if (eventMusiciansError) throw eventMusiciansError;
        scaleSummaryByEventId = buildScaleSummaryByEvent(eventMusiciansData || []);
      }
    }

    if (shouldLoadPrecontracts) {
      const { data, error } = await supabase
        .from('precontracts')
        .select(PRECONTRACTS_SELECT_FIELDS)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      precontracts = data || [];
    }

    if (shouldLoadContracts) {
      const { data, error } = await supabase
        .from('contracts')
        .select(CONTRACTS_SELECT_FIELDS)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      contracts = data || [];
    }

    return NextResponse.json({
      ok: true,
      events,
      scaleSummaryByEventId,
      precontracts,
      contracts,
      workspaceId,
    });
  } catch (error) {
    console.error('[EVENTS_API][GET][ERROR]', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'Erro inesperado ao carregar eventos.',
      },
      { status: 500 }
    );
  }
}
