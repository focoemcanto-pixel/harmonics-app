import { notFound, redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import ClienteHome from '../../../../components/cliente/ClienteHome';
import { resolveSupportWhatsAppConfig } from '../../../../lib/whatsapp/support-config';

const IS_DEV = process.env.NODE_ENV !== 'production';
const CLIENT_EVENT_SELECT_FIELDS = [
  'id',
  'formation',
  'observations',
  'has_ante_room',
  'has_antesala',
  'antesala_requested_by_client',
  'antesala_request_status',
  'antesala_price_increment',
  'antesala_duration_minutes',
].join(', ');
const CLIENT_REPERTOIRE_CONFIG_SELECT_FIELDS = [
  'id',
  'event_id',
  'status',
  'is_locked',
  'submitted_at',
  'has_ante_room',
  'ante_room_style',
  'ante_room_notes',
  'exit_song',
  'exit_reference',
  'exit_notes',
  'has_reception',
  'reception_duration',
  'reception_genres',
  'reception_artists',
  'reception_notes',
  'desired_songs',
  'general_notes',
  'client_public_token',
  'repertoire_pdf_url',
  'pdf_url',
  'exit_reference_title',
  'exit_reference_channel',
  'exit_reference_thumbnail',
  'exit_reference_video_id',
].join(', ');
const CLIENT_REPERTOIRE_ITEMS_SELECT_FIELDS = [
  'id',
  'event_id',
  'section',
  'item_order',
  'label',
  'who_enters',
  'moment',
  'song_name',
  'reference_link',
  'notes',
  'genres',
  'artists',
  'reference_title',
  'reference_channel',
  'reference_thumbnail',
  'reference_video_id',
  'suggestion_song_id',
  'suggestion_song:suggestion_songs(id, title, artist, youtube_url, youtube_id, thumbnail_url)',
].join(', ');

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    console.error(
      '[CLIENTE REPERTORIO PAGE] Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ausentes.'
    );
    return null;
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseLocalDate(value) {
  if (!value) return null;

  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);
    return new Date(year, month, day);
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(dateInput, days) {
  const d = new Date(dateInput);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addHoursToTime(timeValue, deltaHours = 0) {
  if (!timeValue) return '--:--';

  const [h, m] = String(timeValue)
    .split(':')
    .map((v) => Number(v || 0));

  const totalMinutes = h * 60 + m + deltaHours * 60;

  let normalized = totalMinutes % (24 * 60);
  if (normalized < 0) normalized += 24 * 60;

  const hh = String(Math.floor(normalized / 60)).padStart(2, '0');
  const mm = String(normalized % 60).padStart(2, '0');

  return `${hh}:${mm}`;
}

function buildFallbackData(token = '') {
  const safeToken = String(token || '').trim();
  const supportConfig = resolveSupportWhatsAppConfig();

  return {
    token: safeToken,
    clienteNome: 'Cliente',
    eventoTitulo: 'Evento',
    dataEvento: '',
    horarioEvento: '',
    localEvento: '',
    formacao: '',
    instrumentos: '',
    statusContrato: 'Contrato pendente',
    statusEvento: 'A confirmar',
    observacoes: 'Ainda não temos todos os dados do evento. Nossa equipe vai te ajudar.',
    horarioChegada: '--:--',
    suporteWhatsapp: supportConfig.phone,
    suporteWhatsappMensagem: supportConfig.message,
    reviewSubmitted: false,
    repertorio: {
      status: 'NAO_INICIADO',
      isLocked: false,
      etapasPreenchidas: 0,
      totalEtapas: 7,
      liberadoParaEdicao: true,
      enviadoEm: null,
      linkPreenchimento: safeToken ? `/cliente/${safeToken}/repertorio` : '#',
      linkVisualizacao: safeToken ? `/cliente/${safeToken}/repertorio` : '#',
      podeSolicitarCorrecao: false,
      temAntessala: false,
      antesalaDurationMinutes: null,
      antesalaRequestedByClient: false,
      antesalaRequestStatus: '',
      antesalaPriceIncrement: 0,
      antesalaQuoteOptions: [],
      temReceptivo: false,
      receptivoContratadoHoras: 0,
      receptivoDuracaoTravada: false,
      pdfUrl: null,
      repertoireToken: safeToken,
      initialState: {
        querAntessala: null,
        antessala: { estilo: '', generos: '', artistas: '', observacao: '' },
        cortejo: [
          { label: 'Padrinhos', musica: '', referencia: '', observacao: '' },
          { label: 'Noiva', musica: '', referencia: '', observacao: '' },
        ],
        cerimonia: [{ label: 'Alianças', musica: '', referencia: '', observacao: '' }],
        saida: {
          musica: '',
          referencia: '',
          observacao: '',
          reference_title: '',
          reference_channel: '',
          reference_thumbnail: '',
          reference_video_id: '',
        },
        receptivo: { duracao: '1h', generos: '', artistas: '', observacao: '' },
        desiredSongs: '',
        generalNotes: '',
      },
    },
    financeiro: {
      resumo: {
        valorTotal: 'A definir',
        valorPago: 'A definir',
        saldo: 'A definir',
        status: 'Consulte a equipe',
      },
      vencimentos: [],
      historico: [],
    },
  };
}

function mapStatusToUi(status, isLocked) {
  const normalized = String(status || '').toUpperCase();

  if (
    normalized === 'ENVIADO' ||
    normalized === 'ENVIADO_TRANCADO' ||
    normalized === 'FINALIZADO' ||
    normalized === 'CONCLUIDO' ||
    normalized === 'AGUARDANDO_REVISAO'
  ) {
    return normalized;
  }

  if (normalized === 'EM_EDICAO') {
    return 'LIBERADO';
  }

  if (!normalized && isLocked) {
    return 'ENVIADO';
  }

  if (normalized === 'LIBERADO') {
    return 'LIBERADO';
  }

  if (normalized === 'RASCUNHO') {
    return 'RASCUNHO';
  }

  return 'NAO_INICIADO';
}

function computeEtapasPreenchidas(config, items) {
  let total = 0;

  const hasAnteRoom =
    config?.has_ante_room &&
    (config?.ante_room_style || config?.ante_room_notes);

  if (hasAnteRoom) total += 1;

  const cortejoCount = items.filter((item) => item.section === 'cortejo').length;
  if (cortejoCount > 0) total += 1;

  const cerimoniaCount = items.filter((item) => item.section === 'cerimonia').length;
  if (cerimoniaCount > 0) total += 1;

  if (config?.exit_song || config?.exit_reference || config?.exit_notes) {
    total += 1;
  }

  const hasReception =
    config?.has_reception &&
    (config?.reception_duration ||
      config?.reception_genres ||
      config?.reception_artists ||
      config?.reception_notes);

  if (hasReception) total += 1;

  return total;
}

function mapItemsToInitialState(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const cortejo = safeItems
    .filter((item) => item.section === 'cortejo')
    .sort((a, b) => (a.item_order || 0) - (b.item_order || 0))
    .map((item) => ({
      label: item.label || item.who_enters || '',
      musica: item.song_name || item.suggestion_song?.title || '',
      referencia: item.reference_link || item.suggestion_song?.youtube_url || '',
      observacao: item.notes || '',
      reference_title: item.reference_title || '',
      reference_channel: item.reference_channel || '',
      reference_thumbnail: item.reference_thumbnail || '',
      reference_video_id: item.reference_video_id || '',
    }));

  const cerimonia = safeItems
    .filter((item) => item.section === 'cerimonia')
    .sort((a, b) => (a.item_order || 0) - (b.item_order || 0))
    .map((item) => ({
      label: item.label || item.moment || '',
      musica: item.song_name || item.suggestion_song?.title || '',
      referencia: item.reference_link || item.suggestion_song?.youtube_url || '',
      observacao: item.notes || '',
      reference_title: item.reference_title || '',
      reference_channel: item.reference_channel || '',
      reference_thumbnail: item.reference_thumbnail || '',
      reference_video_id: item.reference_video_id || '',
    }));

  const antessalaItems = safeItems
    .filter((item) => item.section === 'antessala')
    .sort((a, b) => (a.item_order || 0) - (b.item_order || 0));
  const antessalaMainItem =
    antessalaItems.find((item) => (item.item_order || 0) < 100) || antessalaItems[0] || null;
  const antessalaReferences = antessalaItems
    .filter((item) => item.reference_link || item.reference_video_id)
    .slice(0, 5)
    .map((item) => ({
      title: item.song_name || item.reference_title || '',
      link: item.reference_link || '',
      reference_title: item.reference_title || '',
      reference_channel: item.reference_channel || '',
      reference_thumbnail: item.reference_thumbnail || '',
      reference_video_id: item.reference_video_id || '',
    }));

  const receptivoItem =
    safeItems
      .filter((item) => item.section === 'receptivo')
      .sort((a, b) => (a.item_order || 0) - (b.item_order || 0))[0] || null;

  return {
    cortejo:
      cortejo.length > 0
        ? cortejo
        : [
            { label: 'Padrinhos', musica: '', referencia: '', observacao: '' },
            { label: 'Noiva', musica: '', referencia: '', observacao: '' },
          ],
    cerimonia:
      cerimonia.length > 0
        ? cerimonia
        : [{ label: 'Alianças', musica: '', referencia: '', observacao: '' }],
    antessala: {
      estilo: antessalaMainItem?.song_name || '',
      generos: antessalaMainItem?.genres || '',
      artistas: antessalaMainItem?.artists || '',
      observacao: antessalaMainItem?.notes || '',
      styleTags: [],
      preferredArtistsEnabled: Boolean(antessalaMainItem?.artists),
      referenceEnabled: antessalaReferences.length > 0,
      references: antessalaReferences,
    },
    receptivo: {
      duracao: '',
      generos: receptivoItem?.genres || '',
      artistas: receptivoItem?.artists || '',
      observacao: receptivoItem?.notes || '',
    },
  };
}

function deriveContractedReceptionHours(...sources) {
  for (const source of sources) {
    const raw =
      source?.reception_hours ??
      source?.reception_duration ??
      source?.receptivo_duration ??
      source?.receptivo_hours ??
      source?.receptivo_horas;
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return 0;
}

function deriveHasContractedReception(...sources) {
  let foundExplicitFalse = false;

  for (const source of sources) {
    const explicit =
      source?.has_reception ??
      source?.has_receptivo ??
      source?.reception_enabled;
    if (explicit === true) return true;
    if (explicit === false) foundExplicitFalse = true;
  }

  if (deriveContractedReceptionHours(...sources) > 0) return true;
  if (foundExplicitFalse) return false;

  return false;
}

function sanitizeResolvedAdjustmentFromObservations(observations, latestAdjustmentRequest) {
  const rawObservation = String(observations || '').trim();
  if (!rawObservation) return '';

  const status = String(latestAdjustmentRequest?.status || '').trim().toLowerCase();
  const rawRequest = String(latestAdjustmentRequest?.request_message || '').trim();
  if (status !== 'resolved' || !rawRequest) return rawObservation;

  const normalizedObservation = rawObservation.toLowerCase();
  const normalizedRequest = rawRequest.toLowerCase();
  const prefixedRequest = `solicitação de ajuste: ${normalizedRequest}`;

  if (
    normalizedObservation === normalizedRequest ||
    normalizedObservation === prefixedRequest
  ) {
    return '';
  }

  return rawObservation;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeFormation(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return '';
  if (s.startsWith('duo')) return 'duo';
  if (s.startsWith('trio')) return 'trio';
  if (s.startsWith('quart')) return 'quarteto';
  if (s.startsWith('quint')) return 'quinteto';
  if (s.startsWith('sext')) return 'sexteto';
  if (s.startsWith('sept')) return 'septeto';
  return '';
}

function buildAntesalaQuoteOptions(formation, pricing = {}) {
  const normalizedFormation = normalizeFormation(formation);
  if (!normalizedFormation) return [];

  const oneHour = toNumber(pricing[`reception_${normalizedFormation}_1h`]);
  const twoHours = toNumber(pricing[`reception_${normalizedFormation}_2h`]);
  const threeHours = toNumber(pricing[`reception_${normalizedFormation}_3h`]);

  if (!oneHour && !twoHours && !threeHours) return [];

  return [
    { minutes: 30, label: '30 min', price: Math.max(oneHour - 200, 0) },
    { minutes: 60, label: '1h', price: oneHour },
    { minutes: 120, label: '2h', price: twoHours || oneHour },
    { minutes: 180, label: '3h', price: threeHours || twoHours || oneHour },
  ];
}

export default async function ClienteRepertorioPage({ params }) {
  const { token } = await params;
  const supabase = getAdminSupabase();
  if (!supabase) {
    return <ClienteHome data={buildFallbackData(token)} initialTab="repertorio" />;
  }
  const requestTimeMs = new Date().getTime();

  const { data: precontractByClientToken, error: precontractByClientTokenError } =
    await supabase
      .from('precontracts')
      .select('id, public_token, event_id')
      .eq('public_token', token)
      .maybeSingle();

  if (precontractByClientTokenError) {
    console.error(
      '[CLIENTE REPERTORIO PAGE] Erro ao buscar precontract por token público:',
      precontractByClientTokenError
    );
  }

  let eventId = precontractByClientToken?.event_id || null;
  let clientToken = precontractByClientToken?.public_token || token;
  let tokenRow = null;

  if (!eventId) {
    const { data: repertoireTokenRow, error: tokenError } = await supabase
      .from('repertoire_tokens')
      .select('id, token, event_id, status, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (tokenError) {
      console.error('[CLIENTE REPERTORIO PAGE] Erro ao buscar repertoire_token:', tokenError);
    }
    if (tokenError || !repertoireTokenRow) {
      return <ClienteHome data={buildFallbackData(token)} initialTab="repertorio" />;
    }

    if (String(repertoireTokenRow.status || '').toLowerCase() !== 'open') {
      notFound();
    }

    if (repertoireTokenRow.expires_at) {
      const expiresAt = new Date(repertoireTokenRow.expires_at);
      if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < requestTimeMs) {
        notFound();
      }
    }

    tokenRow = repertoireTokenRow;
    eventId = repertoireTokenRow.event_id;
  } else {
    const { data: latestToken, error: latestTokenError } = await supabase
      .from('repertoire_tokens')
      .select('id, token, event_id, status, expires_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestTokenError) {
      console.error(
        '[CLIENTE REPERTORIO PAGE] Erro ao buscar token mais recente de repertório:',
        latestTokenError
      );
    } else {
      tokenRow = latestToken || null;
    }
  }

  let eventResp = { data: null, error: null };
  let configResp = { data: null, error: null };
  let itemsResp = { data: [], error: null };
  let precontractsResp = { data: null, error: null };
  let contractsResp = { data: null, error: null };
  let pricingResp = { data: null, error: null };

  try {
    [
      eventResp,
      configResp,
      itemsResp,
      precontractsResp,
      contractsResp,
      pricingResp,
    ] = await Promise.all([
      supabase
        .from('events')
        .select(CLIENT_EVENT_SELECT_FIELDS)
        .eq('id', eventId)
        .maybeSingle(),

      supabase
        .from('repertoire_config')
        .select(CLIENT_REPERTOIRE_CONFIG_SELECT_FIELDS)
        .eq('event_id', eventId)
        .maybeSingle(),

      supabase
        .from('repertoire_items')
        .select(CLIENT_REPERTOIRE_ITEMS_SELECT_FIELDS)
        .eq('event_id', eventId)
        .order('item_order', { ascending: true }),

      supabase
        .from('precontracts')
        .select('id, public_token, event_id, reception_hours, has_sound, has_transport')
        .eq('event_id', eventId)
        .maybeSingle(),

      supabase
        .from('contracts')
        .select('id, event_id, precontract_id, pdf_url, doc_url, signed_at')
        .eq('event_id', eventId)
        .maybeSingle(),

      supabase
        .from('pricing_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  } catch (error) {
    console.error('[CLIENTE REPERTORIO PAGE] Falha inesperada ao carregar dados principais:', error);
  }

  if (eventResp?.error) console.error('[CLIENTE REPERTORIO PAGE] Erro em events:', eventResp.error);
  if (configResp?.error) {
    console.error('[CLIENTE REPERTORIO PAGE] Erro em repertoire_config:', configResp.error);
  }
  if (itemsResp?.error) console.error('[CLIENTE REPERTORIO PAGE] Erro em repertoire_items:', itemsResp.error);
  if (precontractsResp?.error) {
    console.error('[CLIENTE REPERTORIO PAGE] Erro em precontracts:', precontractsResp.error);
  }
  if (contractsResp?.error) console.error('[CLIENTE REPERTORIO PAGE] Erro em contracts:', contractsResp.error);
  if (pricingResp?.error) {
    console.error('[CLIENTE REPERTORIO PAGE] Erro em pricing_settings:', pricingResp.error);
  }

  const event = eventResp?.data || null;
  if (!event) {
    console.error('[CLIENTE REPERTORIO PAGE] Evento ausente após consultas, renderizando fallback.');
    return <ClienteHome data={buildFallbackData(clientToken || token)} initialTab="repertorio" />;
  }

  const config = configResp?.data || null;
  const items = Array.isArray(itemsResp?.data) ? itemsResp.data : [];
  const precontract = precontractsResp?.data || null;
  const contract = contractsResp?.data || null;
  const pricing = pricingResp?.data || {};
  let latestAdjustmentRequest = null;

  if (precontract?.id) {
    const { data: adjustmentData, error: adjustmentError } = await supabase
      .from('contract_adjustment_requests')
      .select('id, status, request_message, created_at, resolved_at')
      .eq('precontract_id', precontract.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (adjustmentError) {
      console.error(
        '[CLIENTE REPERTORIO PAGE] Erro em contract_adjustment_requests:',
        adjustmentError
      );
    } else {
      latestAdjustmentRequest = adjustmentData || null;
    }
  }
  const hasContractedReception = deriveHasContractedReception(config, event, precontract);
  const contractedReceptionHours = deriveContractedReceptionHours(config, event, precontract);
  const sanitizedObservations = sanitizeResolvedAdjustmentFromObservations(
    event?.observations,
    latestAdjustmentRequest
  );

  if (IS_DEV) {
    console.log('[CLIENTE REPERTORIO PAGE] URL PDF contrato:', contract?.pdf_url || '(vazio)');
    console.log(
      '[CLIENTE REPERTORIO PAGE] URL PDF repertório:',
      config?.repertoire_pdf_url || config?.pdf_url || '(vazio)'
    );
  }

  const configClientToken = String(config?.client_public_token || '').trim();
  if (configClientToken) {
    clientToken = configClientToken;
  } else if (precontract?.public_token) {
    clientToken = precontract.public_token;
  }

  const eventDate = parseLocalDate(event.event_date);
  const now = startOfDay(new Date());
  const reviewStartsAt = eventDate ? startOfDay(addDays(eventDate, 1)) : null;

  const shouldRedirectToReview =
    !!reviewStartsAt && now.getTime() > reviewStartsAt.getTime();

  if (shouldRedirectToReview) {
    redirect(`/cliente/${clientToken}/review`);
  }

  const initialLists = mapItemsToInitialState(items);
  const repertorioPdfToken = clientToken;
  const repertorioPdfUrl = repertorioPdfToken
    ? `/api/cliente/repertorio/pdf/${repertorioPdfToken}`
    : null;

  if (IS_DEV) {
    console.log('[CLIENTE REPERTORIO PAGE] token da rota do cliente:', token || '(vazio)');
    console.log(
      '[CLIENTE REPERTORIO PAGE] token público resolvido para cliente:',
      clientToken || '(vazio)'
    );
    console.log(
      '[CLIENTE REPERTORIO PAGE] token usado na URL do PDF:',
      repertorioPdfToken || '(vazio)'
    );
    console.log(
      '[CLIENTE REPERTORIO PAGE] tokens da rota e PDF são idênticos?',
      String(token || '') === String(repertorioPdfToken || '')
    );
  }

  const supportConfig = resolveSupportWhatsAppConfig();

  const data = {
    token: clientToken,
    clienteNome: event.client_name || 'Cliente',
    eventoTitulo: event.client_name
      ? `Evento • ${event.client_name}`
      : 'Evento',
    dataEvento: event.event_date || '',
    horarioEvento: event.event_time || '',
    localEvento: event.location_name || '',
    formacao: event.formation || '',
    instrumentos: event.instruments || '',
    statusContrato: contract?.signed_at ? 'Contrato assinado' : 'Contrato pendente',
    statusEvento: event.status || 'Confirmado',
    observacoes:
      sanitizedObservations ||
      'Alinhar com a assessoria a ordem correta do cortejo e o roteiro enviado à equipe.',
    horarioChegada: addHoursToTime(event.event_time, -2),
    suporteWhatsapp: supportConfig.phone,
    suporteWhatsappMensagem: supportConfig.message,
    reviewSubmitted: false,

    repertorio: {
      status: mapStatusToUi(config?.status, config?.is_locked),
      isLocked: Boolean(config?.is_locked),
      etapasPreenchidas: computeEtapasPreenchidas(config, items),
      totalEtapas: 7,
      liberadoParaEdicao: !config?.is_locked,
      enviadoEm: config?.submitted_at || null,
      linkPreenchimento: `/cliente/${clientToken}/repertorio`,
      linkVisualizacao: `/cliente/${clientToken}/repertorio`,
      podeSolicitarCorrecao:
        String(config?.status || '').toUpperCase() !== 'AGUARDANDO_REVISAO',
      temAntessala: Boolean(
        config?.has_ante_room ??
          event?.has_antesala ??
          event?.has_ante_room ??
          false
      ),
      antesalaDurationMinutes:
        Number(event?.antesala_duration_minutes ?? 0) || null,
      antesalaRequestedByClient: Boolean(event?.antesala_requested_by_client),
      antesalaRequestStatus: String(event?.antesala_request_status || ''),
      antesalaPriceIncrement: Number(event?.antesala_price_increment || 0),
      antesalaQuoteOptions: buildAntesalaQuoteOptions(event?.formation, pricing),
      temReceptivo: Boolean(hasContractedReception),
      receptivoContratadoHoras: contractedReceptionHours || 0,
      receptivoDuracaoTravada: Boolean(hasContractedReception),
      pdfUrl: repertorioPdfUrl,
      repertoireToken: tokenRow?.token || '',

      initialState: {
        querAntessala: config?.has_ante_room ?? null,
        antessala: {
          ...initialLists.antessala,
          estilo: config?.ante_room_style || initialLists.antessala?.estilo || '',
          generos: initialLists.antessala?.generos || '',
          artistas: initialLists.antessala?.artistas || '',
          observacao: config?.ante_room_notes || initialLists.antessala?.observacao || '',
          durationMinutes:
            Number(event?.antesala_duration_minutes ?? 30) || 30,
          styleTags: initialLists.antessala?.styleTags || [],
          preferredArtistsEnabled: Boolean(initialLists.antessala?.preferredArtistsEnabled),
          referenceEnabled: Boolean(initialLists.antessala?.referenceEnabled),
          references: initialLists.antessala?.references || [],
          requestQuoteOpened: false,
          quoteMinutes:
            Number(event?.antesala_duration_minutes ?? 0) || null,
          quotePriceIncrement: Number(event?.antesala_price_increment || 0) || 0,
          requestedByClient: Boolean(event?.antesala_requested_by_client),
        },
        cortejo: initialLists.cortejo,
        cerimonia: initialLists.cerimonia,
        saida: {
          musica: config?.exit_song || '',
          referencia: config?.exit_reference || '',
          observacao: config?.exit_notes || '',
          reference_title: config?.exit_reference_title || '',
          reference_channel: config?.exit_reference_channel || '',
          reference_thumbnail: config?.exit_reference_thumbnail || '',
          reference_video_id: config?.exit_reference_video_id || '',
        },
        receptivo: {
          duracao: `${contractedReceptionHours || 1}h`,
          generos: config?.reception_genres || initialLists.receptivo?.generos || '',
          artistas: config?.reception_artists || initialLists.receptivo?.artistas || '',
          observacao: config?.reception_notes || initialLists.receptivo?.observacao || '',
        },
        desiredSongs: config?.desired_songs || '',
        generalNotes: config?.general_notes || '',
      },
    },

    financeiro: {
      resumo: {
        valorTotal: 'A definir',
        valorPago: 'A definir',
        saldo: 'A definir',
        status: 'Consulte a equipe',
      },
      vencimentos: [],
      historico: [],
    },
  };

  return <ClienteHome data={data} initialTab="repertorio" />;
}
