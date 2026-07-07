import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendAdminWhatsAppAlert } from '@/lib/whatsapp/send-admin-alert';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error('Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.');
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function formatDateBR(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function isMissingColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return code === '42703' || message.includes('does not exist') || message.includes('could not find') || details.includes('schema cache');
}

async function updateEventAntesalaRequest(supabase, eventId) {
  const basePayload = {
    has_antesala: false,
    antesala_enabled: false,
    antesala_requested_by_client: true,
    antesala_request_status: 'pending',
    antesala_price_increment: 0,
    antesala_duration_minutes: null,
  };

  let payload = { ...basePayload };
  const removedColumns = [];

  while (true) {
    const { data, error } = await supabase
      .from('events')
      .update(payload)
      .eq('id', eventId)
      .select('id, client_name, event_date, location_name')
      .maybeSingle();

    if (!error) return { data, removedColumns };

    if (!isMissingColumnError(error)) throw error;

    const message = String(error.message || '');
    const match =
      message.match(/Could not find the '([^']+)' column/i) ||
      message.match(/column "([^"]+)" of relation "events" does not exist/i);
    const column = match?.[1];

    if (!column || !Object.prototype.hasOwnProperty.call(payload, column)) throw error;
    delete payload[column];
    removedColumns.push(column);
  }
}

async function resolveEventFromToken(supabase, token) {
  const { data: repertoireToken, error: repertoireError } = await supabase
    .from('repertoire_tokens')
    .select('event_id, token')
    .eq('token', token)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (repertoireError) throw repertoireError;
  if (repertoireToken?.event_id) return { eventId: repertoireToken.event_id, source: 'repertoire_token' };

  const { data: precontract, error: precontractError } = await supabase
    .from('precontracts')
    .select('event_id, public_token')
    .eq('public_token', token)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (precontractError) throw precontractError;
  if (precontract?.event_id) return { eventId: precontract.event_id, source: 'precontract_token' };

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('event_id, public_token')
    .eq('public_token', token)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (contractError) throw contractError;
  if (contract?.event_id) return { eventId: contract.event_id, source: 'contract_token' };

  return { eventId: null, source: 'not_found' };
}

export async function POST(request) {
  try {
    const supabase = getAdminSupabase();
    const body = await request.json().catch(() => ({}));
    const token = normalizeText(body?.token);

    if (!token) {
      return NextResponse.json({ ok: false, error: 'Token não informado.' }, { status: 400 });
    }

    const resolved = await resolveEventFromToken(supabase, token);
    if (!resolved.eventId) {
      return NextResponse.json({ ok: false, error: 'Repertório não encontrado.' }, { status: 404 });
    }

    const { data: eventRow, removedColumns } = await updateEventAntesalaRequest(supabase, resolved.eventId);

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || 'https://app.bandaharmonics.com';
    const adminUrl = `${appBaseUrl}/eventos/${resolved.eventId}`;
    const message = [
      '🎶 Solicitação de abertura da Antessala',
      `Cliente: ${eventRow?.client_name || 'Cliente'}`,
      `Evento: ${formatDateBR(eventRow?.event_date)}`,
      eventRow?.location_name ? `Local: ${eventRow.location_name}` : null,
      `Origem: ${resolved.source}`,
      `Admin: ${adminUrl}`,
    ].filter(Boolean).join('\n');

    try {
      await sendAdminWhatsAppAlert(message);
    } catch (error) {
      console.error('[ANTESALA_REQUEST][WHATSAPP_ALERT_ERROR]', error);
    }

    return NextResponse.json({
      ok: true,
      status: 'pending',
      eventId: resolved.eventId,
      removedColumns,
    });
  } catch (error) {
    console.error('[ANTESALA_REQUEST][ERROR]', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Não foi possível solicitar a abertura da antessala.' },
      { status: 500 }
    );
  }
}
