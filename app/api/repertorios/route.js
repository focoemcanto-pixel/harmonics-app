import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { getCurrentWorkspace } from '@/lib/workspaces/get-current-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_LIST_LIMIT = 100;
const EVENTS_SELECT_FIELDS = 'id, workspace_id, created_at, client_name, event_type, event_date';
const REPERTOIRE_CONFIG_SELECT_FIELDS = 'id, created_at, event_id, status, is_locked, submitted_at, client_public_token';
const REPERTOIRE_ITEMS_SELECT_FIELDS =
  'id, event_id, section, item_order, song_name, artists, moment, reference_link, reference_title, reference_channel, reference_thumbnail, reference_video_id, notes, label, suggestion_song_id';
const REPERTOIRE_TOKENS_SELECT_FIELDS = 'id, event_id, token, created_at';
const PRECONTRACTS_SELECT_FIELDS = 'id, created_at, event_id, status, public_token';
const CONTRACTS_SELECT_FIELDS = 'id, created_at, event_id, precontract_id, status';

function uniq(list = []) {
  return Array.from(new Set(list.map((item) => String(item || '').trim()).filter(Boolean)));
}

function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return ADMIN_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(parsed), 1), 300);
}

function mergeUniqueById(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const item of list || []) {
      const id = String(item?.id || '').trim();
      if (!id || map.has(id)) continue;
      map.set(id, item);
    }
  }
  return Array.from(map.values());
}

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[REPERTORIOS_API]' });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.error }, { status: auth.status || 401 });
    }

    const { workspaceId } = await getCurrentWorkspace({ supabase });
    const { searchParams } = new URL(request.url);
    const limit = normalizeLimit(searchParams.get('limit'));

    const { data: scopedEvents, error: scopedEventsError } = await supabase
      .from('events')
      .select(EVENTS_SELECT_FIELDS)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (scopedEventsError) throw scopedEventsError;

    // Durante a migração multi-tenant, alguns repertórios legados podem estar ligados
    // a eventos antigos ainda sem workspace_id. Incluímos esses eventos apenas aqui
    // para não ocultar repertórios em produção antes do backfill final.
    const { data: legacyConfigRows, error: legacyConfigError } = await supabase
      .from('repertoire_config')
      .select('event_id')
      .not('event_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (legacyConfigError) throw legacyConfigError;

    const scopedEventIds = uniq((scopedEvents || []).map((event) => event?.id));
    const configEventIds = uniq((legacyConfigRows || []).map((cfg) => cfg?.event_id));
    const missingConfigEventIds = configEventIds.filter((eventId) => !scopedEventIds.includes(String(eventId)));

    let legacyEvents = [];
    if (missingConfigEventIds.length > 0) {
      const { data: legacyEventsData, error: legacyEventsError } = await supabase
        .from('events')
        .select(EVENTS_SELECT_FIELDS)
        .in('id', missingConfigEventIds)
        .is('workspace_id', null);

      if (legacyEventsError) throw legacyEventsError;
      legacyEvents = legacyEventsData || [];
    }

    const events = mergeUniqueById(scopedEvents || [], legacyEvents || []);
    const eventIds = uniq(events.map((event) => event?.id));

    if (eventIds.length === 0) {
      return NextResponse.json({
        ok: true,
        events: [],
        configs: [],
        items: [],
        tokens: [],
        precontracts: [],
        contracts: [],
        workspaceId,
        debug: {
          eventsCount: 0,
          scopedEventsCount: 0,
          legacyEventsCount: 0,
          configsCount: 0,
          itemsCount: 0,
          tokensCount: 0,
          precontractsCount: 0,
          contractsCount: 0,
        },
      });
    }

    const [configsRes, tokensRes, precontractsRes, contractsRes] = await Promise.all([
      supabase
        .from('repertoire_config')
        .select(REPERTOIRE_CONFIG_SELECT_FIELDS)
        .in('event_id', eventIds)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('repertoire_tokens')
        .select(REPERTOIRE_TOKENS_SELECT_FIELDS)
        .in('event_id', eventIds)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('precontracts')
        .select(PRECONTRACTS_SELECT_FIELDS)
        .in('event_id', eventIds)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('contracts')
        .select(CONTRACTS_SELECT_FIELDS)
        .in('event_id', eventIds)
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);

    if (configsRes.error) throw configsRes.error;
    if (tokensRes.error) throw tokensRes.error;
    if (precontractsRes.error) throw precontractsRes.error;
    if (contractsRes.error) throw contractsRes.error;

    const loadedConfigEventIds = uniq((configsRes.data || []).map((cfg) => cfg?.event_id));

    let items = [];
    if (loadedConfigEventIds.length > 0) {
      const { data: itemsData, error: itemsError } = await supabase
        .from('repertoire_items')
        .select(REPERTOIRE_ITEMS_SELECT_FIELDS)
        .in('event_id', loadedConfigEventIds);

      if (itemsError) throw itemsError;
      items = itemsData || [];
    }

    return NextResponse.json({
      ok: true,
      events,
      configs: configsRes.data || [],
      items,
      tokens: tokensRes.data || [],
      precontracts: precontractsRes.data || [],
      contracts: contractsRes.data || [],
      workspaceId,
      debug: {
        eventsCount: events.length,
        scopedEventsCount: (scopedEvents || []).length,
        legacyEventsCount: legacyEvents.length,
        configsCount: (configsRes.data || []).length,
        itemsCount: items.length,
        tokensCount: (tokensRes.data || []).length,
        precontractsCount: (precontractsRes.data || []).length,
        contractsCount: (contractsRes.data || []).length,
      },
    });
  } catch (error) {
    console.error('[REPERTORIOS_API][GET][ERROR]', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'Erro ao carregar repertórios.',
      },
      { status: 500 }
    );
  }
}
