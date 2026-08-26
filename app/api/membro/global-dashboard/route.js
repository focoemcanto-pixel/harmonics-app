import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireMemberAgendaAccess } from '@/lib/api/require-schedule-manager-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CONTRACTS_SELECT = [
  'id',
  'precontract_id',
  'event_id',
  'status',
  'pdf_url',
  'doc_url',
  'signed_at',
].join(', ');

const REPERTOIRE_CONFIG_SELECT = [
  'id',
  'event_id',
  'status',
  'is_locked',
  'submitted_at',
  'repertoire_pdf_url',
  'has_ante_room',
  'ante_room_style',
  'ante_room_notes',
  'has_reception',
  'reception_duration',
  'reception_genres',
  'reception_artists',
  'reception_notes',
].join(', ');

const REPERTOIRE_ITEMS_SELECT = [
  'id',
  'event_id',
  'item_order',
  'song_name',
  'moment',
  'who_enters',
  'reference_link',
  'reference_video_id',
  'notes',
  'type',
  'label',
  'section',
  'genres',
  'artists',
].join(', ');

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEventDate(value) {
  if (!value) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime());
}

function isActiveSystemEvent(event = {}) {
  const status = normalizeStatus(event?.status);
  if (!status) return true;
  return !['deleted', 'cancelled', 'canceled', 'cancelado', 'arquivado', 'archived'].includes(status);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireMemberAgendaAccess({
      supabase,
      request,
      logPrefix: '[MEMBER_GLOBAL_DASHBOARD]',
    });

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status || 401 }
      );
    }

    const url = new URL(request.url);
    const selectedEventId = String(url.searchParams.get('eventId') || '').trim();

    let eventsQuery = supabase
      .from('events')
      .select('*')
      .eq('workspace_id', auth.workspaceId)
      .order('event_date', { ascending: true })
      .order('event_time', { ascending: true });

    if (selectedEventId) eventsQuery = eventsQuery.eq('id', selectedEventId);

    const { data: rawEvents, error: eventsError } = await eventsQuery;
    if (eventsError) throw eventsError;

    const events = asArray(rawEvents).filter(
      (event) => isActiveSystemEvent(event) && isValidEventDate(event?.event_date)
    );
    const eventIds = events.map((event) => event.id).filter(Boolean);

    if (eventIds.length === 0) {
      return NextResponse.json({
        ok: true,
        workspaceId: auth.workspaceId,
        delegatedAgendaViewer: auth.delegatedAgendaViewer === true,
        events: [],
        scales: [],
        invites: [],
        precontracts: [],
        contracts: [],
        repertoireConfigs: [],
        repertoireItems: [],
      });
    }

    const [
      scalesResp,
      precontractsResp,
      contractsResp,
      repertoireConfigsResp,
      repertoireItemsResp,
    ] = await Promise.all([
      supabase
        .from('event_musicians')
        .select('id, event_id, musician_id, musician_name, snapshot_name, role, status, notes')
        .in('event_id', eventIds),
      supabase
        .from('precontracts')
        .select('id, event_id, public_token, reception_hours, has_sound, has_transport')
        .in('event_id', eventIds),
      supabase
        .from('contracts')
        .select(CONTRACTS_SELECT)
        .in('event_id', eventIds),
      supabase
        .from('repertoire_config')
        .select(REPERTOIRE_CONFIG_SELECT)
        .in('event_id', eventIds),
      supabase
        .from('repertoire_items')
        .select(REPERTOIRE_ITEMS_SELECT)
        .in('event_id', eventIds)
        .order('item_order', { ascending: true }),
    ]);

    const firstError = [
      scalesResp.error,
      precontractsResp.error,
      contractsResp.error,
      repertoireConfigsResp.error,
      repertoireItemsResp.error,
    ].find(Boolean);
    if (firstError) throw firstError;

    const scales = asArray(scalesResp.data);
    const scaleByEventId = new Map(
      scales.map((row) => [String(row?.event_id || '').trim(), row])
    );

    const invites = events.map((event) => {
      const scaleRow = scaleByEventId.get(String(event?.id || '').trim()) || null;
      return {
        id: `global-event-${event.id}`,
        event_id: event.id,
        contact_id: auth.contact?.id || auth.userId,
        suggested_role_name:
          scaleRow?.role || scaleRow?.snapshot_name || scaleRow?.musician_name || '',
        message: scaleRow?.notes || '',
        status: 'confirmed',
        sent_at: event?.created_at || null,
        responded_at: event?.created_at || null,
        created_at: event?.created_at || null,
        events: event,
        source_flags: {
          globalAgenda: true,
          adminPreview: auth.canAdminWorkspace === true,
          delegatedAgendaViewer: auth.delegatedAgendaViewer === true,
        },
      };
    });

    return NextResponse.json({
      ok: true,
      workspaceId: auth.workspaceId,
      delegatedAgendaViewer: auth.delegatedAgendaViewer === true,
      events,
      scales,
      invites,
      precontracts: asArray(precontractsResp.data),
      contracts: asArray(contractsResp.data),
      repertoireConfigs: asArray(repertoireConfigsResp.data),
      repertoireItems: asArray(repertoireItemsResp.data),
    });
  } catch (error) {
    console.error('[MEMBER_GLOBAL_DASHBOARD][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Não foi possível carregar a agenda global.' },
      { status: 500 }
    );
  }
}
