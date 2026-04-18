import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getYoutubeVideoId } from '../../../../lib/youtube/getYoutubeVideoId';
import { randomUUID } from 'node:crypto';
import { sendAdminWhatsAppAlert } from '@/lib/whatsapp/send-admin-alert';

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

function countItemsBySection(items = []) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const section = String(item?.section || 'sem_secao').trim() || 'sem_secao';
    acc[section] = (acc[section] || 0) + 1;
    return acc;
  }, {});
}

function hasUsefulSectionContent(item = {}) {
  return Boolean(
    normalizeText(item?.song_name) ||
      normalizeText(item?.reference_link) ||
      normalizeText(item?.reference_title) ||
      normalizeText(item?.reference_channel) ||
      normalizeText(item?.reference_thumbnail) ||
      normalizeText(item?.reference_video_id) ||
      normalizeText(item?.notes) ||
      normalizeText(item?.genres) ||
      normalizeText(item?.artists)
  );
}

function buildEventAntesalaUpdatePayload({
  antesalaIncluded,
  antesalaDurationMinutes,
  antesalaRequestedByClient,
  antesalaRequestStatus,
  antesalaPriceIncrement,
}) {
  return {
    has_antesala: antesalaIncluded,
    antesala_enabled: antesalaIncluded,
    antesala_requested_by_client: antesalaRequestedByClient,
    antesala_request_status: antesalaRequestStatus,
    antesala_price_increment: antesalaPriceIncrement,
    antesala_duration_minutes: antesalaDurationMinutes,
  };
}

function resolveAntesalaRequestStatus({ antesalaIncluded, antesalaRequestedByClient }) {
  if (antesalaRequestedByClient) return 'pending';
  if (antesalaIncluded) return 'approved';
  return null;
}

async function findSuggestionSongIdForItem(supabase, item) {
  const title = normalizeText(item?.song_name);
  if (!title) return null;

  const artist = normalizeText(item?.artists);
  const youtubeId = normalizeText(item?.reference_video_id);

  if (youtubeId) {
    const { data, error } = await supabase
      .from('suggestion_songs')
      .select('id')
      .eq('youtube_id', youtubeId)
      .eq('source_type', 'admin')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data?.id || null;
  }

  const { data, error } = await supabase
    .from('suggestion_songs')
    .select('id')
    .eq('normalized_title', String(title).toLowerCase())
    .eq('normalized_artist', String(artist || '').toLowerCase())
    .eq('source_type', 'admin')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.id || null;
}

async function attachCatalogSongIds(supabase, items = []) {
  const idByKey = new Map();

  const buildKey = (item) => {
    const youtubeId = normalizeText(item?.reference_video_id);
    if (youtubeId) return `yt:${youtubeId}`;

    const title = String(normalizeText(item?.song_name) || '').toLowerCase();
    const artist = String(normalizeText(item?.artists) || '').toLowerCase();
    return `txt:${title}::${artist}`;
  };

  const normalizedItems = [];

  for (const item of items) {
    const hasTitle = Boolean(normalizeText(item?.song_name));
    const key = buildKey(item);

    if (!hasTitle) {
      normalizedItems.push({ ...item, suggestion_song_id: null });
      continue;
    }

    if (!idByKey.has(key)) {
      const suggestionSongId = await findSuggestionSongIdForItem(supabase, item);
      idByKey.set(key, suggestionSongId);
    }

    normalizedItems.push({
      ...item,
      suggestion_song_id: idByKey.get(key) || null,
    });
  }

  return normalizedItems;
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

function buildRepertoireSummary(items = []) {
  const cortejo = items.filter((item) => item.section === 'cortejo').length;
  const cerimonia = items.filter((item) => item.section === 'cerimonia').length;
  const hasSaida = items.some((item) => item.section === 'saida');

  return `Cortejo: ${cortejo} | Cerimônia: ${cerimonia} | Saída: ${hasSaida ? 'sim' : 'não'}`;
}

function formatDurationLabel(minutes) {
  const value = Number(minutes || 0);
  if (!value) return 'Não definido';
  if (value === 30) return '30 min';
  if (value % 60 === 0) return `${value / 60}h`;
  return `${value} min`;
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

async function getFallbackClientPublicTokenByEvent(supabase, eventId) {
  if (!eventId) return null;

  const { data: precontract, error } = await supabase
    .from('precontracts')
    .select('public_token')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return normalizeText(precontract?.public_token);
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
    const antesalaFlow = body?.antesalaFlow || {};

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

    const incomingItems = normalizeItems(rawItems);
    console.log('[API REPERTORIO] payload config recebido:', config);
    console.log('[API REPERTORIO] payload itens recebido (normalizado):', incomingItems);
    console.log('[API REPERTORIO] quantidade de itens por seção (payload):', countItemsBySection(incomingItems));
    console.log('[API][ITEMS_RECEIVED]', incomingItems);

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

    const { data: existingConfig, error: existingConfigError } = await supabase
      .from('repertoire_config')
      .select('client_public_token, is_locked, status')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingConfigError) throw existingConfigError;

    if (existingConfig?.is_locked) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Repertório bloqueado. Aguarde a liberação da equipe para editar novamente.',
          status: existingConfig.status || 'BLOQUEADO',
          locked: true,
        },
        { status: 423 }
      );
    }

    const tokenFromConfig = normalizeText(existingConfig?.client_public_token);
    const tokenFromRequest = normalizeText(clientTokenInput);
    const fallbackClientToken =
      tokenResolution === 'client_token'
        ? normalizeText(clientTokenInput || token)
        : null;
    const resolvedClientPublicToken =
      tokenFromRequest ||
      tokenFromConfig ||
      fallbackClientToken ||
      (await getFallbackClientPublicTokenByEvent(supabase, eventId));

    const configPayload = {
      event_id: eventId,
      repertoire_token_id: tokenRow.id,
      client_public_token: resolvedClientPublicToken,
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

    if (mode === 'final') {
      configPayload.repertoire_pdf_url = `/api/cliente/repertorio/pdf/${tokenRow.token}`;
    }

    const antesalaIncluded = normalizeBool(antesalaFlow.included);
    const requestedByClientFromPayload = normalizeBool(antesalaFlow.requestedByClient);
    const durationFromPayload = Number(antesalaFlow.durationMinutes || 0) || null;
    const priceIncrementFromPayload = Number(antesalaFlow.priceIncrement || 0) || 0;

    const { data: currentEventBeforeRoom, error: currentEventBeforeRoomError } = await supabase
      .from('events')
      .select(
        'antesala_requested_by_client, antesala_request_status, antesala_duration_minutes, antesala_price_increment'
      )
      .eq('id', eventId)
      .maybeSingle();

    if (currentEventBeforeRoomError) throw currentEventBeforeRoomError;

    const preservePendingBeforeRoomRequest =
      !antesalaIncluded &&
      !requestedByClientFromPayload &&
      Boolean(currentEventBeforeRoom?.antesala_requested_by_client);
    const antesalaRequestedByClient = preservePendingBeforeRoomRequest
      ? true
      : requestedByClientFromPayload;
    const antesalaDurationMinutes =
      durationFromPayload ||
      (preservePendingBeforeRoomRequest
        ? Number(currentEventBeforeRoom?.antesala_duration_minutes || 0) || null
        : null);
    const antesalaPriceIncrement =
      priceIncrementFromPayload ||
      (preservePendingBeforeRoomRequest
        ? Number(currentEventBeforeRoom?.antesala_price_increment || 0) || 0
        : 0);
    const antesalaRequestStatus = resolveAntesalaRequestStatus({
      antesalaIncluded,
      antesalaRequestedByClient,
    });

    const primaryEventPayload = buildEventAntesalaUpdatePayload({
      antesalaIncluded,
      antesalaDurationMinutes,
      antesalaRequestedByClient,
      antesalaRequestStatus,
      antesalaPriceIncrement,
    });

    const { error: updateEventError } = await supabase
      .from('events')
      .update(primaryEventPayload)
      .eq('id', eventId);

    if (updateEventError) throw updateEventError;

    const { error: upsertConfigError } = await supabase
      .from('repertoire_config')
      .upsert(configPayload, {
        onConflict: 'event_id',
      });

    if (upsertConfigError) {
      throw upsertConfigError;
    }

    if (mode === 'final') {
      const [{ data: persistedConfig, error: persistedConfigError }, { data: contractRow, error: contractError }] =
        await Promise.all([
          supabase
            .from('repertoire_config')
            .select('event_id, repertoire_pdf_url')
            .eq('event_id', eventId)
            .maybeSingle(),
          supabase
            .from('contracts')
            .select('event_id, pdf_url')
            .eq('event_id', eventId)
            .maybeSingle(),
        ]);

      if (persistedConfigError) throw persistedConfigError;
      if (contractError) throw contractError;

      console.log('[API REPERTORIO] URL PDF contrato (somente leitura):', contractRow?.pdf_url || '(vazio)');
      console.log(
        '[API REPERTORIO] URL PDF repertório salvo:',
        persistedConfig?.repertoire_pdf_url || '(vazio)'
      );
    }

    const { data: existingItems, error: existingItemsError } = await supabase
      .from('repertoire_items')
      .select(
        'section, item_order, who_enters, moment, song_name, reference_link, reference_title, reference_channel, reference_thumbnail, reference_video_id, notes, type, group_name, label, genres, artists, suggestion_song_id'
      )
      .eq('event_id', eventId);

    if (existingItemsError) throw existingItemsError;

    const existingBySection = countItemsBySection(existingItems || []);
    const incomingBySection = countItemsBySection(incomingItems);
    const incomingSections = new Set(incomingItems.map((item) => String(item.section || '').trim()).filter(Boolean));
    const missingSectionsFromIncoming = Object.keys(existingBySection).filter(
      (section) => !incomingSections.has(section)
    );

    let itemsToPersist = incomingItems;

    if (missingSectionsFromIncoming.length > 0) {
      const preservedItems = (existingItems || []).filter((item) =>
        missingSectionsFromIncoming.includes(String(item.section || '').trim())
      );
      itemsToPersist = [...incomingItems, ...preservedItems];
      console.warn(
        '[API REPERTORIO] payload parcial detectado; preservando seções não enviadas:',
        missingSectionsFromIncoming
      );
    }

    if (incomingItems.length === 0 && (existingItems || []).length > 0) {
      console.error(
        '[API REPERTORIO] bloqueando overwrite destrutivo: payload sem itens e evento já possui itens persistidos.'
      );
      return NextResponse.json(
        {
          ok: false,
          error:
            'Payload parcial detectado (sem itens). Salvamento bloqueado para evitar perda de dados do rascunho.',
        },
        { status: 409 }
      );
    }

    const protectedSections = ['cortejo', 'cerimonia'];
    const sectionsPreservedByInvalidPayload = [];

    protectedSections.forEach((section) => {
      const incomingSectionItems = incomingItems.filter(
        (item) => String(item?.section || '').trim() === section
      );
      if (incomingSectionItems.length === 0) return;

      const hasUsefulIncomingSectionItem = incomingSectionItems.some((item) =>
        hasUsefulSectionContent(item)
      );

      if (hasUsefulIncomingSectionItem) return;

      const existingSectionItems = (existingItems || []).filter(
        (item) => String(item?.section || '').trim() === section
      );

      itemsToPersist = itemsToPersist.filter(
        (item) => String(item?.section || '').trim() !== section
      );

      if (existingSectionItems.length > 0) {
        itemsToPersist.push(...existingSectionItems);
      }

      sectionsPreservedByInvalidPayload.push(section);
    });

    const itemsWithCatalogLink = await attachCatalogSongIds(supabase, itemsToPersist);
    console.log('[API][ITEMS_TO_SAVE]', itemsWithCatalogLink);

    console.log('[API REPERTORIO] itens existentes por seção (antes de salvar):', existingBySection);
    console.log('[API REPERTORIO] itens recebidos por seção:', incomingBySection);
    console.log('[API REPERTORIO] seções ausentes no payload.itens:', missingSectionsFromIncoming);
    console.log(
      '[API REPERTORIO] seções protegidas por payload sem conteúdo útil:',
      sectionsPreservedByInvalidPayload
    );
    console.log(
      '[API REPERTORIO] quantidade final de itens por seção (após preservação):',
      countItemsBySection(itemsWithCatalogLink)
    );

    const { error: deleteItemsError } = await supabase
      .from('repertoire_items')
      .delete()
      .eq('event_id', eventId);

    if (deleteItemsError) {
      throw deleteItemsError;
    }
    console.log('[API][ITEMS_DELETED]', {
      eventId,
      deletedAllForEvent: true,
    });

    if (itemsWithCatalogLink.length > 0) {
      const itemsPayload = itemsWithCatalogLink.map((item) => ({
        event_id: eventId,
        repertoire_token_id: tokenRow.id,
        suggestion_song_id: item.suggestion_song_id,
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
      console.log('[API][ITEMS_INSERT_RESULT]', {
        eventId,
        insertedCount: itemsPayload.length,
      });
    } else {
      console.log('[API][ITEMS_INSERT_RESULT]', {
        eventId,
        insertedCount: 0,
      });
    }

    if (mode === 'final') {
      const [{ data: eventRow, error: eventError }, { data: precontractRow, error: precontractError }] =
        await Promise.all([
          supabase
            .from('events')
            .select('client_name, event_date, location_name')
            .eq('id', eventId)
            .maybeSingle(),
          supabase
            .from('precontracts')
            .select('public_token')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      if (eventError) throw eventError;
      if (precontractError) throw precontractError;

      const pdfToken = normalizeText(precontractRow?.public_token) || normalizeText(clientTokenInput) || normalizeText(token);
      const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || '';
      const pdfPath = pdfToken ? `/api/cliente/repertorio/pdf/${pdfToken}` : '';
      const pdfUrl = appBaseUrl ? `${appBaseUrl}${pdfPath}` : pdfPath;

      const alertMessage = [
        `✅ Repertório enviado por ${eventRow?.client_name || 'Cliente'}`,
        `📅 Evento: ${formatDateBR(eventRow?.event_date)}`,
        eventRow?.location_name ? `📍 Local: ${eventRow.location_name}` : null,
        `📝 Resumo: ${buildRepertoireSummary(itemsWithCatalogLink)}`,
        pdfUrl ? `📄 PDF: ${pdfUrl}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      try {
        await sendAdminWhatsAppAlert(alertMessage);
      } catch (whatsappError) {
        console.error('[API REPERTORIO] Não foi possível enviar alerta WhatsApp para admin:', whatsappError);
      }
    }

    if (antesalaRequestedByClient) {
      const { data: eventRow, error: eventBeforeRoomError } = await supabase
        .from('events')
        .select('client_name, event_date, formation')
        .eq('id', eventId)
        .maybeSingle();

      if (eventBeforeRoomError) throw eventBeforeRoomError;

      const beforeRoomAlert = [
        'Novo pedido de antesala',
        '',
        `Evento: CLIENT_REQUEST_ANTESALA`,
        `Cliente: ${eventRow?.client_name || 'Cliente'}`,
        `Evento: ${formatDateBR(eventRow?.event_date)}`,
        `Formação: ${eventRow?.formation || 'Não definida'}`,
        '',
        'Solicitou:',
        `Antesala - ${formatDurationLabel(antesalaDurationMinutes)}`,
        '',
        'Aguardando validação.',
      ].join('\n');

      try {
        await sendAdminWhatsAppAlert(beforeRoomAlert);
      } catch (whatsappError) {
        console.error('[API REPERTORIO] Não foi possível enviar alerta de solicitação de antesala:', whatsappError);
      }
    }

    return NextResponse.json({
      ok: true,
      eventId,
      status,
      savedItems: itemsWithCatalogLink.length,
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
