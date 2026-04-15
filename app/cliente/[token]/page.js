import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import ClienteHome from '../../../components/cliente/ClienteHome';
import { resolveSupportWhatsAppConfig } from '../../../lib/whatsapp/support-config';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    console.error(
      '[CLIENTE PAGE] Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ausentes.'
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

  const safeItems = Array.isArray(items) ? items : [];
  const hasAnteRoom =
    config?.has_ante_room &&
    (config?.ante_room_style || config?.ante_room_notes);

  if (hasAnteRoom) total += 1;

  const cortejoCount = safeItems.filter((item) => item.section === 'cortejo').length;
  if (cortejoCount > 0) total += 1;

  const cerimoniaCount = safeItems.filter((item) => item.section === 'cerimonia').length;
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
  };
}

function buildFinancialSummary(event) {
  const total = Number(event?.total_price || event?.amount || 0);
  const paid = Number(event?.amount_paid || event?.paid_amount || 0);
  const saldo = Math.max(total - paid, 0);

  const toBRL = (value) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(value || 0));

  return {
    valorTotal: total > 0 ? toBRL(total) : 'A definir',
    valorPago: paid > 0 ? toBRL(paid) : 'A definir',
    saldo: total > 0 ? toBRL(saldo) : 'A definir',
    status:
      saldo <= 0 && total > 0
        ? 'Quitado'
        : paid > 0
        ? 'Em aberto'
        : 'Consulte a equipe',
  };
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

function buildFallbackData(token = '') {
  const supportConfig = resolveSupportWhatsAppConfig();
  const safeToken = String(token || '').trim();

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
      pdfUrl: null,
      repertoireToken: safeToken,
      initialState: {
        querAntessala: null,
        antessala: {
          estilo: '',
          generos: '',
          artistas: '',
          observacao: '',
        },
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
        receptivo: {
          duracao: '1h',
          generos: '',
          artistas: '',
          observacao: '',
        },
        desiredSongs: '',
        generalNotes: '',
      },
    },
    financeiro: {
      resumo: buildFinancialSummary(null),
      vencimentos: [],
      historico: [],
    },
  };
}

export default async function ClienteTokenPage({ params }) {
  const { token } = await params;
  const supabase = getAdminSupabase();

  if (!supabase) {
    return <ClienteHome data={buildFallbackData(token)} />;
  }

  let precontract = null;

  try {
    const { data: precontractData, error: precontractError } = await supabase
      .from('precontracts')
      .select('id, public_token, event_id')
      .eq('public_token', token)
      .maybeSingle();

    if (precontractError) {
      console.error('[CLIENTE PAGE] Erro ao buscar precontract:', precontractError);
    } else {
      precontract = precontractData || null;
    }
  } catch (error) {
    console.error('[CLIENTE PAGE] Falha inesperada ao buscar precontract:', error);
  }

  const eventId = precontract?.event_id;
  if (!eventId) {
    console.error('[CLIENTE PAGE] Evento não encontrado para token informado:', token);
    return <ClienteHome data={buildFallbackData(token)} />;
  }

  let eventResp = { data: null, error: null };
  let configResp = { data: null, error: null };
  let itemsResp = { data: [], error: null };
  let contractsResp = { data: null, error: null };
  let repertoireTokenResp = { data: null, error: null };
  let paymentsResp = { data: [], error: null };
  let pricingResp = { data: null, error: null };

  try {
    [
      eventResp,
      configResp,
      itemsResp,
      contractsResp,
      repertoireTokenResp,
      paymentsResp,
      pricingResp,
    ] = await Promise.all([
      supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle(),

      supabase
        .from('repertoire_config')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle(),

      supabase
        .from('repertoire_items')
        .select('*, suggestion_song:suggestion_songs(id, title, artist, youtube_url, youtube_id, thumbnail_url)')
        .eq('event_id', eventId)
        .order('item_order', { ascending: true }),

      supabase
        .from('contracts')
        .select('id, event_id, precontract_id, pdf_url, doc_url, signed_at')
        .eq('event_id', eventId)
        .maybeSingle(),

      supabase
        .from('repertoire_tokens')
        .select('id, token, event_id, status, expires_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from('payments')
        .select('id, amount, payment_date, payment_method, status, notes, proof_file_url')
        .eq('event_id', eventId)
        .order('payment_date', { ascending: false }),

      supabase
        .from('pricing_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  } catch (error) {
    console.error('[CLIENTE PAGE] Falha inesperada ao carregar dados principais:', error);
  }

  if (eventResp?.error) console.error('[CLIENTE PAGE] Erro em events:', eventResp.error);
  if (configResp?.error) console.error('[CLIENTE PAGE] Erro em repertoire_config:', configResp.error);
  if (itemsResp?.error) console.error('[CLIENTE PAGE] Erro em repertoire_items:', itemsResp.error);
  if (contractsResp?.error) console.error('[CLIENTE PAGE] Erro em contracts:', contractsResp.error);
  if (repertoireTokenResp?.error) {
    console.error('[CLIENTE PAGE] Erro em repertoire_tokens:', repertoireTokenResp.error);
  }
  if (paymentsResp?.error) console.error('[CLIENTE PAGE] Erro em payments:', paymentsResp.error);
  if (pricingResp?.error) {
    console.error('[CLIENTE PAGE] Erro em pricing_settings:', pricingResp.error);
  }

  const event = eventResp?.data || null;
  const config = configResp?.data || null;
  const items = Array.isArray(itemsResp?.data) ? itemsResp.data : [];
  const contract = contractsResp?.data || null;
  const repertoireToken = repertoireTokenResp?.data || null;
  const payments = Array.isArray(paymentsResp?.data) ? paymentsResp.data : [];
  const pricing = pricingResp?.data || {};

  if (!event) {
    console.error('[CLIENTE PAGE] Evento ausente após consultas, renderizando fallback.');
    return <ClienteHome data={buildFallbackData(token)} />;
  }

  const configClientToken = String(config?.client_public_token || '').trim();
  const clientToken = configClientToken || token;

  console.log('[CLIENTE PAGE] URL PDF contrato:', contract?.pdf_url || '(vazio)');
  console.log(
    '[CLIENTE PAGE] URL PDF repertório:',
    config?.repertoire_pdf_url || config?.pdf_url || '(vazio)'
  );

  const eventDate = parseLocalDate(event.event_date);
  const now = startOfDay(new Date());
  const reviewStartsAt = eventDate ? startOfDay(addDays(eventDate, 1)) : null;

  const shouldRedirectToReview =
    !!reviewStartsAt && now.getTime() > reviewStartsAt.getTime();

  if (shouldRedirectToReview) {
    redirect(`/cliente/${clientToken}/review`);
  }

  const initialLists = mapItemsToInitialState(items);

  const repertorioTokenValue = repertoireToken?.token || token;
  const repertorioPdfToken = clientToken;
  const repertorioPdfUrl = repertorioPdfToken
    ? `/api/cliente/repertorio/pdf/${repertorioPdfToken}`
    : null;

  console.log('[CLIENTE PAGE] token da rota do cliente:', token || '(vazio)');
  console.log('[CLIENTE PAGE] token usado na URL do PDF:', repertorioPdfToken || '(vazio)');
  console.log(
    '[CLIENTE PAGE] tokens da rota e PDF são idênticos?',
    String(token || '') === String(repertorioPdfToken || '')
  );

  const supportConfig = resolveSupportWhatsAppConfig();
  const paymentHistory = payments.map((entry) => ({
    label: 'Comprovante enviado',
    date: entry.payment_date || '',
    amount:
      typeof entry.amount === 'number'
        ? new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(entry.amount)
        : '—',
    status: String(entry.status || '').trim().toUpperCase() || 'EM_ANALISE',
    note: entry.notes || '',
    fileName: entry.proof_file_url || '',
  }));

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
      event.observations ||
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
          event?.has_antessala ??
          false
      ),
      antesalaDurationMinutes:
        Number(event?.antesala_duration_minutes || 0) || null,
      antesalaRequestedByClient: Boolean(event?.antesala_requested_by_client),
      antesalaRequestStatus: String(event?.antesala_request_status || ''),
      antesalaPriceIncrement: Number(event?.antesala_price_increment || 0),
      antesalaQuoteOptions: buildAntesalaQuoteOptions(event?.formation, pricing),
      temReceptivo: Boolean(
        config?.has_reception ??
          event?.has_reception ??
          event?.has_receptivo ??
          false
      ),
      pdfUrl: repertorioPdfUrl,
      repertoireToken: repertorioTokenValue,

      initialState: {
        querAntessala: config?.has_ante_room ?? null,
        antessala: {
          estilo: config?.ante_room_style || '',
          generos: '',
          artistas: '',
          observacao: config?.ante_room_notes || '',
          durationMinutes: Number(event?.antesala_duration_minutes || 30) || 30,
          styleTags: [],
          preferredArtistsEnabled: false,
          referenceEnabled: false,
          references: [],
          requestQuoteOpened: false,
          quoteMinutes: Number(event?.antesala_duration_minutes || 0) || null,
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
          duracao: config?.reception_duration || '1h',
          generos: config?.reception_genres || '',
          artistas: config?.reception_artists || '',
          observacao: config?.reception_notes || '',
        },
        desiredSongs: config?.desired_songs || '',
        generalNotes: config?.general_notes || '',
      },
    },

    financeiro: {
      resumo: buildFinancialSummary(event),
      vencimentos: [],
      historico: paymentHistory,
    },
  };

  return <ClienteHome data={data} />;
}
