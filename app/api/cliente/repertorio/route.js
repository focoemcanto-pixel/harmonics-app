import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getYoutubeVideoId } from '../../../../lib/youtube/getYoutubeVideoId';
import { randomUUID } from 'node:crypto';

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

function normalizeReferenceMetadata({
  referenceLink,
  referenceTitle,
  referenceChannel,
  referenceThumbnail,
  referenceVideoId,
}) {
  const normalizedLink = normalizeText(referenceLink);
  const providedVideoId = normalizeText(referenceVideoId);
  const videoIdFromLink = getYoutubeVideoId(normalizedLink || '');

  if (!normalizedLink) {
    return {
      reference_title: null,
      reference_channel: null,
      reference_thumbnail: null,
      reference_video_id: null,
    };
  }

  let normalizedVideoId = providedVideoId || videoIdFromLink || null;
  let normalizedTitle = normalizeText(referenceTitle);
  let normalizedChannel = normalizeText(referenceChannel);
  let normalizedThumbnail = normalizeText(referenceThumbnail);

  if (videoIdFromLink && providedVideoId && videoIdFromLink !== providedVideoId) {
    normalizedTitle = null;
    normalizedChannel = null;
    normalizedThumbnail = null;
    normalizedVideoId = videoIdFromLink;
  }

  if (!normalizedVideoId) {
    normalizedTitle = null;
    normalizedChannel = null;
    normalizedThumbnail = null;
  }

  return {
    reference_title: normalizedTitle,
    reference_channel: normalizedChannel,
    reference_thumbnail: normalizedThumbnail,
    reference_video_id: normalizedVideoId,
  };
}

function normalizeItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      const referenceLink = normalizeText(item.reference_link);
      const referenceMetadata = normalizeReferenceMetadata({
        referenceLink,
        referenceTitle: item.reference_title,
        referenceChannel: item.reference_channel,
        referenceThumbnail: item.reference_thumbnail,
        referenceVideoId: item.reference_video_id,
      });

      return {
        section: normalizeText(item.section),
        item_order:
          Number.isFinite(Number(item.item_order))
            ? Number(item.item_order)
            : index,
        who_enters: normalizeText(item.who_enters),
        moment: normalizeText(item.moment),
        song_name: normalizeText(item.song_name),
        reference_link: referenceLink,
        ...referenceMetadata,
        notes: normalizeText(item.notes),
        type: normalizeText(item.type),
        group_name: normalizeText(item.group_name),
        label: normalizeText(item.label),
        genres: normalizeText(item.genres),
        artists: normalizeText(item.artists),
      };
    })
    .filter((item) => {
      return (
        item.section ||
        item.who_enters ||
        item.moment ||
        item.song_name ||
        item.reference_link ||
        item.reference_title ||
        item.reference_channel ||
        item.reference_thumbnail ||
        item.reference_video_id ||
        item.notes ||
        item.type ||
        item.group_name ||
        item.label ||
        item.genres ||
        item.artists
      );
    });
}

async function findLatestRepertoireTokenByEvent(supabase, eventId) {
  const { data, error } = await supabase
    .from('repertoire_tokens')
    .select('id, event_id, token, status, expires_at, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function ensureOpenRepertoireToken(supabase, eventId) {
  const existing = await findLatestRepertoireTokenByEvent(supabase, eventId);

  if (existing && String(existing.status || '').toLowerCase() === 'open') {
    if (existing.expires_at) {
      const expiresAt = new Date(existing.expires_at);
      if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
        // token aberto porém expirado -> cria um novo
      } else {
        return { tokenRow: existing, created: false };
      }
    } else {
      return { tokenRow: existing, created: false };
    }
  }

  const payload = {
    event_id: eventId,
    token: randomUUID(),
    status: 'open',
  };

  const { data: inserted, error: insertError } = await supabase
    .from('repertoire_tokens')
    .insert(payload)
    .select('id, event_id, token, status, expires_at, created_at')
    .single();

  if (insertError) throw insertError;
  return { tokenRow: inserted, created: true };
}

export async function POST(request) {
  try {
    const supabase = getAdminSupabase();
    const body = await request.json();

    const token = String(body?.token || '').trim();
    const repertoireTokenInput = String(body?.repertoireToken || '').trim();
    const clientTokenInput = String(body?.clientToken || '').trim();
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

    const tokenCandidate = repertoireTokenInput || token;
    let tokenRow = null;
    let eventId = null;
    let tokenResolution = 'none';
    let createdToken = false;

    if (tokenCandidate) {
      const { data: tokenRows, error: tokenError } = await supabase
        .from('repertoire_tokens')
        .select('id, event_id, token, status, expires_at, created_at')
        .eq('token', tokenCandidate)
        .order('created_at', { ascending: false })
        .limit(1);

      if (tokenError) throw tokenError;
      tokenRow = tokenRows?.[0] || null;
    }

    if (tokenRow) {
      tokenResolution = 'repertoire_token';
      eventId = tokenRow.event_id;

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
    } else {
      const clientToken = clientTokenInput || token;
      const { data: precontract, error: precontractError } = await supabase
        .from('precontracts')
        .select('id, public_token, event_id')
        .eq('public_token', clientToken)
        .maybeSingle();

      if (precontractError) throw precontractError;

      if (!precontract?.event_id) {
        return NextResponse.json(
          { ok: false, error: 'Token de repertório inválido.' },
          { status: 404 }
        );
      }

      eventId = precontract.event_id;
      tokenResolution = 'client_token';
      const ensured = await ensureOpenRepertoireToken(supabase, eventId);
      tokenRow = ensured.tokenRow;
      createdToken = ensured.created;
    }

    console.log('[API REPERTORIO] token recebido:', token);
    console.log('[API REPERTORIO] repertoireToken explícito:', repertoireTokenInput || '(não informado)');
    console.log('[API REPERTORIO] clientToken explícito:', clientTokenInput || '(não informado)');
    console.log('[API REPERTORIO] estratégia resolução:', tokenResolution);
    console.log('[API REPERTORIO] token validado:', tokenRow?.token);
    console.log('[API REPERTORIO] event_id resolvido:', eventId);
    console.log('[API REPERTORIO] repertoire_token criado nesta chamada:', createdToken);

    const items = normalizeItems(rawItems);

    const status = mode === 'final' ? 'ENVIADO' : 'RASCUNHO';
    const isLocked = mode === 'final';
    const exitReference = normalizeText(config.exit_reference);
    const exitReferenceMetadata = normalizeReferenceMetadata({
      referenceLink: exitReference,
      referenceTitle: config.exit_reference_title,
      referenceChannel: config.exit_reference_channel,
      referenceThumbnail: config.exit_reference_thumbnail,
      referenceVideoId: config.exit_reference_video_id,
    });

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
      exit_reference: exitReference,
      exit_reference_title: exitReferenceMetadata.reference_title,
      exit_reference_channel: exitReferenceMetadata.reference_channel,
      exit_reference_thumbnail: exitReferenceMetadata.reference_thumbnail,
      exit_reference_video_id: exitReferenceMetadata.reference_video_id,
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
        reference_title: item.reference_title,
        reference_channel: item.reference_channel,
        reference_thumbnail: item.reference_thumbnail,
        reference_video_id: item.reference_video_id,
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
