import { buildRepertoirePdfHtml } from '@/lib/repertorio/buildRepertoirePdfHtml';
import { generatePdfBufferFromHtml } from '@/lib/contracts/htmlToPdfService';
import { logInfo } from '@/lib/observability/server-log';

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function compactText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeSection(value) {
  const raw = compactText(value).toLowerCase();
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    normalized === 'custom_event' ||
    normalized === 'customevent' ||
    normalized === 'custom' ||
    normalized === 'musicas_especificas' ||
    normalized === 'musicasespecificas'
  ) return 'custom';

  return normalized;
}

function safeLog(category, message, payload) {
  try {
    logInfo(category, message, payload);
  } catch {
    // no-op (safe log)
  }
}

function parseArraySafe(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseCustomSongs(value) {
  const rawSongs = parseArraySafe(value);

  return rawSongs
    .map((song, index) => {
      if (!song || typeof song !== 'object') return null;

      const songName =
        compactText(song.song_name) ||
        compactText(song.title) ||
        compactText(song.nome) ||
        null;
      const referenceLink = compactText(song.reference_link) || null;
      const referenceTitle =
        compactText(song.reference_title) ||
        compactText(song.reference_channel) ||
        compactText(song.reference_video_id) ||
        null;
      const artists = compactText(song.artists) || compactText(song.artist) || null;
      const notes = compactText(song.notes) || null;

      if (!songName && !referenceLink && !artists && !notes) return null;

      return {
        section: 'custom',
        songName,
        referenceTitle,
        referenceLink,
        artists,
        genres: compactText(song.genres) || null,
        notes,
        order: Number(song.order ?? index) || index,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function parseCustomSongsFromItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => {
      const normalizedSection = normalizeSection(item?.section);
      const itemType = compactText(item?.type);
      return itemType === 'custom_event_song' || normalizedSection === 'custom';
    })
    .map((item, index) => {
      const songName =
        compactText(item?.songName) ||
        compactText(item?.song_name) ||
        compactText(item?.title) ||
        null;
      const referenceLink = compactText(item?.referenceLink) || compactText(item?.reference_link) || null;
      const referenceTitle =
        compactText(item?.referenceTitle) ||
        compactText(item?.reference_title) ||
        compactText(item?.reference_channel) ||
        compactText(item?.reference_video_id) ||
        null;
      const artists = compactText(item?.artists) || null;
      const notes = compactText(item?.notes) || null;

      if (!songName && !referenceLink && !artists && !notes) return null;

      return {
        section: 'custom',
        songName,
        referenceTitle,
        referenceLink,
        artists,
        genres: compactText(item?.genres) || null,
        notes,
        order: Number(item?.item_order ?? index) || index,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function detectEventType(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const candidates = [
      source.event_type,
      source.eventType,
      source.type,
      source.tipo_evento,
      source.event_category,
      source.custom_event_type,
    ];
    for (const candidate of candidates) {
      const normalized = compactText(candidate).toLowerCase();
      if (normalized) return normalized;
    }
  }
  return '';
}

function resolveEventTypeLabel(eventType, isCustomEvent) {
  const normalized = compactText(eventType).toLowerCase();
  if (normalized.includes('chá') || normalized.includes('cha')) return 'Chá';
  if (normalized.includes('receptivo')) return 'Receptivo';
  if (normalized.includes('show')) return 'Show';
  if (normalized.includes('corporativo')) return 'Evento corporativo';
  if (isCustomEvent) return 'Evento';
  return 'Cerimonial Musical';
}

export async function generateRepertoirePdf({
  supabase,
  eventId,
  token,
  clientToken,
}) {
  logInfo('REPERTOIRE_PDF', 'START', {
    marker: '[REPERTOIRE_PDF][START]',
    eventId,
    token: normalizeText(token),
    clientToken: normalizeText(clientToken),
  });

  if (!supabase) throw new Error('Supabase é obrigatório para gerar PDF do repertório.');
  if (!eventId) throw new Error('eventId é obrigatório para gerar PDF do repertório.');

  const [configResult, itemsResult, eventResult] = await Promise.all([
    supabase
      .from('repertoire_config')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('repertoire_items')
      .select('*')
      .eq('event_id', eventId)
      .order('item_order', { ascending: true }),
    supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle(),
  ]);

  if (configResult.error) throw configResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (eventResult.error) throw eventResult.error;

  const config = configResult.data || {};
  const items = itemsResult.data || [];
  const event = eventResult.data || {};
  const normalizedItems = (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    section: normalizeSection(item?.section),
  }));
  const baseSelectedStyles = parseArraySafe(config?.selected_styles)
    .map((entry) => compactText(entry))
    .filter(Boolean);
  const customMetaItem = normalizedItems.find((item) =>
    normalizeSection(item?.section) === 'custom' &&
    String(item?.type || '').trim() === 'custom_event_meta'
  );
  const selectedStylesFromMeta = compactText(customMetaItem?.genres)
    .split(',')
    .map((entry) => compactText(entry))
    .filter(Boolean);
  const selectedStyles =
    baseSelectedStyles.length > 0
      ? baseSelectedStyles
      : selectedStylesFromMeta;
  const preferredArtists =
    compactText(config?.preferred_artists) ||
    compactText(customMetaItem?.artists) ||
    null;
  const customSongsFromItems = parseCustomSongsFromItems(normalizedItems);
  const customSongs =
    customSongsFromItems.length > 0
      ? customSongsFromItems
      : parseCustomSongs(config?.custom_songs);
  const detectedEventType = detectEventType(config, event);
  const hasCustomTypeHint = ['cha', 'chá', 'receptivo', 'show', 'corporativo', 'custom'].some((hint) =>
    detectedEventType.includes(hint)
  );
  const isCustomEvent =
    selectedStyles.length > 0 ||
    Boolean(preferredArtists) ||
    customSongs.length > 0 ||
    hasCustomTypeHint;
  const eventTypeLabel = resolveEventTypeLabel(detectedEventType, isCustomEvent);

  safeLog('REPERTOIRE_PDF', 'custom-event-items-debug', {
    status: 'custom-event-items-debug',
    eventId,
    customRawItemsCount: normalizedItems.filter((item) => normalizeSection(item?.section) === 'custom').length,
    customSongItemsCount: customSongsFromItems.length,
    hasCustomMetaItem: Boolean(customMetaItem),
    selectedStylesCount: selectedStyles.length,
    hasPreferredArtists: Boolean(preferredArtists),
  });

  logInfo('REPERTOIRE_PDF', 'custom-event-debug', {
    status: 'custom-event-debug',
    eventId,
    isCustomEvent,
    eventTypeLabel,
    selectedStylesCount: selectedStyles.length,
    hasPreferredArtists: Boolean(preferredArtists),
    customSongsCount: customSongs.length,
  });

  let client = null;
  const contactId = event?.contact_id;
  if (contactId) {
    const { data: clientRow, error: clientError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .maybeSingle();

    if (clientError) throw clientError;
    client = clientRow || null;
  }

  const html = buildRepertoirePdfHtml({
    event,
    client,
    config,
    items: normalizedItems,
    eventTypeLabel,
    isCustomEvent,
    selectedStyles,
    preferredArtists,
    customSongs,
  });

  logInfo('REPERTOIRE_PDF', 'HTML_READY', {
    marker: '[REPERTOIRE_PDF][HTML_READY]',
    eventId,
    itemsCount: items.length,
  });

  const pdfBuffer = await generatePdfBufferFromHtml({
    html,
    contractId: null,
    precontractId: null,
    applyPremiumContractCss: false,
    fileName: `repertorio-${eventId}.pdf`,
  });

  logInfo('REPERTOIRE_PDF', 'PDF_GENERATED', {
    marker: '[REPERTOIRE_PDF][PDF_GENERATED]',
    eventId,
    bytes: pdfBuffer?.length || 0,
  });

  return {
    ok: true,
    pdfBuffer,
    fileName: `repertorio-${eventId}.pdf`,
  };
}
