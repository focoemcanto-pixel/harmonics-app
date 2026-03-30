import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      'Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.'
    );
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeBool(value) {
  return value === true;
}

function normalizeItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => ({
      section: normalizeText(item.section),
      item_order:
        Number.isFinite(Number(item.item_order))
          ? Number(item.item_order)
          : index,
      who_enters: normalizeText(item.who_enters),
      moment: normalizeText(item.moment),
      song_name: normalizeText(item.song_name),
      reference_link: normalizeText(item.reference_link),
      notes: normalizeText(item.notes),
      type: normalizeText(item.type),
      group_name: normalizeText(item.group_name),
      label: normalizeText(item.label),
      genres: normalizeText(item.genres),
      artists: normalizeText(item.artists),
    }))
    .filter((item) => {
      return (
        item.section ||
        item.who_enters ||
        item.moment ||
        item.song_name ||
        item.reference_link ||
        item.notes ||
        item.type ||
        item.group_name ||
        item.label ||
        item.genres ||
        item.artists
      );
    });
}

export async function POST(request) {
  try {
    const supabase = getAdminSupabase();
    const body = await request.json();

    const token = String(body?.token || '').trim();
    const mode = String(body?.mode || 'draft').trim().toLowerCase();
    const config = body?.config || {};
    const rawItems = body?.items || [];

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Token não informado.' },
        { status: 400 }
      );
    }

    if (!['draft', 'final'].includes(mode)) {
      return NextResponse.json(
        { ok: false, error: 'Modo inválido. Use draft ou final.' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    const { data: tokenRows, error: tokenError } = await supabase
  .from('repertoire_tokens')
  .select('id, event_id, token, status, expires_at, created_at')
  .eq('token', token)
  .order('created_at', { ascending: false })
  .limit(1);

if (tokenError) {
  throw tokenError;
}

if (!tokenRows || tokenRows.length === 0) {
  return NextResponse.json(
    { ok: false, error: 'Token de repertório inválido.' },
    { status: 404 }
  );
}

const tokenRow = tokenRows[0];

console.log('[API REPERTORIO] token recebido:', token);
console.log('[API REPERTORIO] token encontrado:', tokenRow?.token);
console.log('[API REPERTORIO] event_id:', tokenRow?.event_id);

if (String(tokenRow.status || '').toLowerCase() !== 'open') {
      return NextResponse.json(
        { ok: false, error: 'Este link de repertório não está disponível.' },
        { status: 403 }
      );
    }

    if (tokenRow.expires_at) {
      const expiresAt = new Date(tokenRow.expires_at);
      if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
        return NextResponse.json(
          { ok: false, error: 'Este link de repertório expirou.' },
          { status: 403 }
        );
      }
    }

    const eventId = tokenRow.event_id;
    const items = normalizeItems(rawItems);

    const status = mode === 'final' ? 'ENVIADO' : 'RASCUNHO';
    const isLocked = mode === 'final';

    const configPayload = {
      event_id: eventId,
      repertoire_token_id: tokenRow.id,
      has_ante_room: normalizeBool(config.has_ante_room),
      ante_room_style: normalizeText(config.ante_room_style),
      ante_room_notes: normalizeText(config.ante_room_notes),
      has_reception: normalizeBool(config.has_reception),
      reception_duration: normalizeText(config.reception_duration),
      reception_genres: normalizeText(config.reception_genres),
      reception_artists: normalizeText(config.reception_artists),
      reception_notes: normalizeText(config.reception_notes),
      exit_song: normalizeText(config.exit_song),
      exit_reference: normalizeText(config.exit_reference),
      exit_notes: normalizeText(config.exit_notes),
      desired_songs: normalizeText(config.desired_songs),
      general_notes: normalizeText(config.general_notes),
      status,
      is_locked: isLocked,
      submitted_at: mode === 'final' ? nowIso : null,
      last_saved_at: nowIso,
    };

    const { error: upsertConfigError } = await supabase
      .from('repertoire_config')
      .upsert(configPayload, {
        onConflict: 'event_id',
      });

    if (upsertConfigError) {
      throw upsertConfigError;
    }

    const { error: deleteItemsError } = await supabase
      .from('repertoire_items')
      .delete()
      .eq('event_id', eventId);

    if (deleteItemsError) {
      throw deleteItemsError;
    }

    if (items.length > 0) {
      const itemsPayload = items.map((item) => ({
        event_id: eventId,
        repertoire_token_id: tokenRow.id,
        section: item.section,
        item_order: item.item_order,
        who_enters: item.who_enters,
        moment: item.moment,
        song_name: item.song_name,
        reference_link: item.reference_link,
        notes: item.notes,
        type: item.type,
        group_name: item.group_name,
        label: item.label,
        genres: item.genres,
        artists: item.artists,
      }));

      const { error: insertItemsError } = await supabase
        .from('repertoire_items')
        .insert(itemsPayload);

      if (insertItemsError) {
        throw insertItemsError;
      }
    }

    return NextResponse.json({
      ok: true,
      eventId,
      status,
      savedItems: items.length,
      locked: isLocked,
    });
  } catch (error) {
    console.error('Erro ao salvar repertório do cliente:', error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Não foi possível salvar o repertório.',
      },
      { status: 500 }
    );
  }
}
