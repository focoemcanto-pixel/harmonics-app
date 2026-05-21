import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchClientSuggestionsCatalog } from '@/lib/sugestoes/client-suggestions-catalog';

function asString(value) {
  return String(value || '').trim();
}

async function resolveWorkspaceId({ supabase, token, eventId }) {
  const normalizedEventId = asString(eventId);
  const normalizedToken = asString(token);

  if (normalizedEventId) {
    const { data: eventRow } = await supabase
      .from('events')
      .select('id, workspace_id')
      .eq('id', normalizedEventId)
      .maybeSingle();

    if (asString(eventRow?.workspace_id)) {
      return asString(eventRow.workspace_id);
    }
  }

  if (!normalizedToken) return '';

  const { data: precontract } = await supabase
    .from('precontracts')
    .select('id, workspace_id, event_id, public_token')
    .eq('public_token', normalizedToken)
    .maybeSingle();

  if (asString(precontract?.event_id)) {
    const { data: preEvent } = await supabase
      .from('events')
      .select('id, workspace_id')
      .eq('id', precontract.event_id)
      .maybeSingle();

    if (asString(preEvent?.workspace_id)) return asString(preEvent.workspace_id);
  }

  if (asString(precontract?.workspace_id)) return asString(precontract.workspace_id);

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, workspace_id, event_id, precontract_id, public_token')
    .eq('public_token', normalizedToken)
    .maybeSingle();

  if (asString(contract?.event_id)) {
    const { data: contractEvent } = await supabase
      .from('events')
      .select('id, workspace_id')
      .eq('id', contract.event_id)
      .maybeSingle();
    if (asString(contractEvent?.workspace_id)) return asString(contractEvent.workspace_id);
  }

  if (asString(contract?.precontract_id)) {
    const { data: linkedPrecontract } = await supabase
      .from('precontracts')
      .select('id, workspace_id, event_id')
      .eq('id', contract.precontract_id)
      .maybeSingle();
    if (asString(linkedPrecontract?.event_id)) {
      const { data: linkedPreEvent } = await supabase
        .from('events')
        .select('id, workspace_id')
        .eq('id', linkedPrecontract.event_id)
        .maybeSingle();
      if (asString(linkedPreEvent?.workspace_id)) return asString(linkedPreEvent.workspace_id);
    }
    if (asString(linkedPrecontract?.workspace_id)) return asString(linkedPrecontract.workspace_id);
  }

  if (asString(contract?.workspace_id)) return asString(contract.workspace_id);

  return '';
}

export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const token = asString(searchParams.get('token'));
    const eventId = asString(searchParams.get('event_id'));
    const eventType = asString(searchParams.get('event_type'));
    const moment = asString(searchParams.get('moment'));

    const workspaceId = await resolveWorkspaceId({ supabase, token, eventId });

    console.log('[cliente/sugestoes] request', {
      token: token || null,
      eventId: eventId || null,
      workspaceId: workspaceId || null,
      eventTypeResolved: eventType || null,
      filters: {
        event_type: eventType || null,
        moment: moment || null,
      },
      fetchDescriptor: {
        table: 'suggestion_songs',
        where: ['is_active = true'],
      },
    });

    if (!workspaceId) {
      console.warn('[cliente/sugestoes] workspace not resolved from token/event; using global suggestions catalog');
    }

    const songs = await fetchClientSuggestionsCatalog(supabase, { workspaceId });

    console.log('[cliente/sugestoes] response', {
      count: songs.length,
      workspaceId: workspaceId || null,
      eventTypeResolved: eventType || null,
    });

    return NextResponse.json({ ok: true, songs, workspaceId: workspaceId || null, empty: songs.length === 0 });
  } catch (error) {
    console.error('[cliente/sugestoes] erro ao carregar sugestões', {
      message: error?.message || 'unknown error',
      details: error?.details || null,
      hint: error?.hint || null,
      code: error?.code || null,
      stack: error?.stack || null,
    });

    return NextResponse.json(
      {
        ok: false,
        songs: [],
        error: 'Não foi possível carregar sugestões no momento.',
      },
      { status: 200 }
    );
  }
}
