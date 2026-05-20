import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import ClienteHome from '../../../components/cliente/ClienteHome';
import { resolveSupportWhatsAppConfig } from '../../../lib/whatsapp/support-config';
import { calculateEventFinance, isConfirmedPayment, normalizeFinanceStatus, toMoneyNumber } from '../../../lib/finance/event-finance';

const IS_DEV = process.env.NODE_ENV !== 'production';
const CLIENT_EVENT_SELECT_FIELDS = [
  'id',
  'client_name',
  'event_type',
  'event_date',
  'event_time',
  'location_name',
  'location_address',
  'formation',
  'instruments',
  'reception_formation',
  'reception_instruments',
  'status',
  'observations',
  'agreed_amount',
  'open_amount',
  'paid_amount',
  'payment_status',
  'signal_due_date',
  'balance_due_date',
  'card_due_date',
  'total_price',
  'amount',
  'amount_paid',
  'has_antesala',
  'antesala_enabled',
  'antesala_requested_by_client',
  'antesala_request_status',
  'antesala_price_increment',
  'antesala_duration_minutes',
].join(', ');
const CLIENT_EVENT_SELECT_FIELDS_FALLBACK = [
  'id',
  'client_name',
  'event_type',
  'event_date',
  'event_time',
  'location_name',
  'location_address',
  'formation',
  'instruments',
  'reception_formation',
  'reception_instruments',
  'status',
  'observations',
  'agreed_amount',
  'open_amount',
  'paid_amount',
  'payment_status',
  'signal_due_date',
  'balance_due_date',
  'card_due_date',
  'total_price',
  'amount',
  'amount_paid',
  'has_antesala',
  'antesala_enabled',
  'antesala_price_increment',
].join(', ');
const CLIENT_EVENT_SELECT_FIELDS_MINIMAL_FALLBACK = [
  'id',
  'client_name',
  'event_type',
  'event_date',
  'event_time',
  'location_name',
  'location_address',
  'formation',
  'instruments',
  'reception_formation',
  'reception_instruments',
  'status',
  'observations',
].join(', ');
const CLIENT_PRECONTRACT_BASE_SELECT_FIELDS = [
  'id',
  'workspace_id',
  'public_token',
  'event_id',
  'event_type_id',
  'event_type',
  'event_date',
  'event_time',
  'location_name',
  'location_address',
  'contract_template_id',
  'reception_hours',
  'reception_formation',
  'reception_instruments',
  'has_sound',
  'has_transport',
  'formation',
  'instruments',
  'reception_formation',
  'reception_instruments',
].join(', ');
const CLIENT_PRECONTRACT_BASE_SELECT_FIELDS_FALLBACK = [
  'id',
  'workspace_id',
  'public_token',
  'event_id',
  'event_date',
  'event_time',
  'location_name',
  'location_address',
  'reception_hours',
  'reception_formation',
  'reception_instruments',
  'has_sound',
  'has_transport',
  'formation',
  'instruments',
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
  'exit_reference_title',
  'exit_reference_channel',
  'exit_reference_thumbnail',
  'exit_reference_video_id',
].join(', ');
const CLIENT_REPERTOIRE_ITEMS_SELECT_FIELDS = '*';
const CLIENT_PRICING_SELECT_FIELDS = [
  'id',
  'created_at',
  'reception_duo_1h',
  'reception_duo_2h',
  'reception_duo_3h',
  'reception_trio_1h',
  'reception_trio_2h',
  'reception_trio_3h',
  'reception_quarteto_1h',
  'reception_quarteto_2h',
  'reception_quarteto_3h',
  'reception_quinteto_1h',
  'reception_quinteto_2h',
  'reception_quinteto_3h',
  'reception_sexteto_1h',
  'reception_sexteto_2h',
  'reception_sexteto_3h',
  'reception_septeto_1h',
  'reception_septeto_2h',
  'reception_septeto_3h',
].join(', ');

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

function computeCustomEventStepsFilled(customEventState = {}) {
  const selectedStyles = Array.isArray(customEventState?.selected_styles)
    ? customEventState.selected_styles.filter((entry) => String(entry || '').trim())
    : [];
  const preferredArtists = String(customEventState?.preferred_artists || '').trim();
  const customSongs = Array.isArray(customEventState?.custom_songs)
    ? customEventState.custom_songs
        .slice(0, 8)
        .filter(
          (song) =>
            String(song?.song_name || '').trim() ||
            String(song?.reference_link || '').trim() ||
            String(song?.notes || '').trim()
        )
    : [];

  let total = 0;
  if (selectedStyles.length > 0) total += 1;
  if (preferredArtists) total += 1;
  if (customSongs.length > 0) total += 1;
  return total;
}

function normalizeRepertoireSection(section) {
  const normalized = String(section || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const normalizedWithoutSpaces = normalized.replace(/\s+/g, '');

  if (normalizedWithoutSpaces === 'cortejo') return 'cortejo';
  if (normalizedWithoutSpaces === 'cerimonia') return 'cerimonia';
  if (normalizedWithoutSpaces === 'saida') return 'saida';
  if (normalizedWithoutSpaces === 'antesala' || normalizedWithoutSpaces === 'antessala') return 'antesala';
  if (normalizedWithoutSpaces === 'receptivo') return 'receptivo';

  return '';
}

function extractInstrumentsFromSoloText(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return '';

  const soloWithSeparator = normalized.match(/^solo[\s:,\-–—]+(.+)$/i);
  if (soloWithSeparator?.[1]) {
    return soloWithSeparator[1].trim();
  }

  const soloWithSpace = normalized.match(/^solo\s+(.+)$/i);
  if (soloWithSpace?.[1]) {
    return soloWithSpace[1].trim();
  }

  return '';
}

function hasUsefulTraceItem(item = {}) {
  return Boolean(
    String(item?.song_name || item?.musica || '').trim() ||
      String(item?.reference_link || item?.referencia || '').trim() ||
      String(item?.notes || item?.observacao || '').trim() ||
      String(item?.reference_title || '').trim() ||
      String(item?.reference_channel || '').trim() ||
      String(item?.reference_thumbnail || '').trim() ||
      String(item?.reference_video_id || '').trim()
  );
}

function pickTraceItemBySection(items = [], section = '') {
  const item = (Array.isArray(items) ? items : []).find((entry) => {
    const entrySection = normalizeRepertoireSection(entry?.section || section);
    return entrySection === section && hasUsefulTraceItem(entry);
  });
  if (!item) return null;
  return {
    section,
    item_order: Number(item?.item_order ?? 0),
    label: String(item?.label || '').trim(),
    song_name: String(item?.song_name || item?.musica || '').trim(),
    reference_link: String(item?.reference_link || item?.referencia || '').trim(),
    notes: String(item?.notes || item?.observacao || '').trim(),
    reference_video_id: String(item?.reference_video_id || '').trim(),
  };
}

function resolveAntesalaRequestFromEvent(event) {
  const status = String(event?.antesala_request_status || '')
    .trim()
    .toLowerCase();

  if (status === 'pending') {
    return {
      requestedByClient: true,
      status: 'pending',
    };
  }

  if (status === 'approved' || status === 'rejected') {
    return {
      requestedByClient: false,
      status,
    };
  }

  return {
    requestedByClient: Boolean(event?.antesala_requested_by_client),
    status: String(event?.antesala_request_status || ''),
  };
}

function mapItemsToInitialState(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const classifiedItems = safeItems.map((item, index) => ({
    index,
    section_raw: item?.section ?? null,
    section_normalized: normalizeRepertoireSection(item?.section),
    item_order: Number(item?.item_order ?? 0),
    label: String(item?.label || item?.who_enters || item?.moment || '').trim(),
    song_name: String(item?.song_name || item?.suggestion_song?.title || '').trim(),
    reference_link: String(item?.reference_link || item?.suggestion_song?.youtube_url || '').trim(),
    notes: String(item?.notes || '').trim(),
    useful: hasUsefulTraceItem(item),
  }));

  const cortejo = safeItems
    .filter((item) => normalizeRepertoireSection(item.section) === 'cortejo')
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
    .filter((item) => normalizeRepertoireSection(item.section) === 'cerimonia')
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
    .filter((item) => normalizeRepertoireSection(item.section) === 'antesala')
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
      .filter((item) => normalizeRepertoireSection(item.section) === 'receptivo')
      .sort((a, b) => (a.item_order || 0) - (b.item_order || 0))[0] || null;
  const customEventItems = safeItems
    .filter((item) => String(item.section || '').trim().toLowerCase() === 'custom_event')
    .sort((a, b) => (a.item_order || 0) - (b.item_order || 0));
  const customEventMetaItem =
    customEventItems.find((item) => String(item.type || '').trim() === 'custom_event_meta') ||
    customEventItems[0] ||
    null;
  const customSongs = customEventItems
    .filter((item) => String(item.type || '').trim() === 'custom_event_song')
    .slice(0, 8)
    .map((item) => ({
      song_name: item.song_name || '',
      reference_link: item.reference_link || '',
      reference_title: item.reference_title || '',
      reference_channel: item.reference_channel || '',
      reference_thumbnail: item.reference_thumbnail || '',
      reference_video_id: item.reference_video_id || '',
      notes: item.notes || '',
    }));
  const customStyles = String(customEventMetaItem?.genres || '')
    .split(',')
    .map((style) => style.trim())
    .filter(Boolean);

  const mappedState = {
    cortejo: cortejo.length > 0 ? cortejo : [],
    cerimonia: cerimonia.length > 0 ? cerimonia : [],
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
    customEvent: {
      selected_styles: customStyles,
      preferred_artists: customEventMetaItem?.artists || '',
      custom_songs: customSongs,
    },
  };

  console.log(
    '[MAP][CORTEJO_ITEMS]',
    classifiedItems.filter((item) => item.section_normalized === 'cortejo')
  );
  console.log(
    '[MAP][CERIMONIA_ITEMS]',
    classifiedItems.filter((item) => item.section_normalized === 'cerimonia')
  );
  console.log(
    '[MAP][UNKNOWN_OR_EMPTY_SECTION_ITEMS]',
    classifiedItems.filter((item) => !item.section_normalized)
  );

  console.log('[TRACE][CORTEJO][INITIAL_STATE]', pickTraceItemBySection(mappedState.cortejo, 'cortejo'));
  console.log('[TRACE][CERIMONIA][INITIAL_STATE]', pickTraceItemBySection(mappedState.cerimonia, 'cerimonia'));

  return mappedState;
}

function formatCurrencyBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

function formatDateToBR(value) {
  if (!value) return '';
  const date = parseLocalDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function toPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toNonNegativeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function pickFirstPositiveNumber(candidates = []) {
  for (const value of candidates) {
    const n = toPositiveNumber(value);
    if (n > 0) return n;
  }
  return 0;
}

function formatFinanceStatusLabel(status) {
  const normalized = normalizeFinanceStatus(status);
  if (normalized === 'paid') return 'Pago';
  if (normalized === 'partial') return 'Parcialmente pago';
  if (normalized === 'pending') return 'Pagamento pendente';
  if (normalized === 'cancelled') return 'Cancelado';
  return 'Pagamento pendente';
}

function buildFinancialData({ event, precontract, payments = [] }) {
  const totalAmount = pickFirstPositiveNumber([precontract?.agreed_amount, event?.agreed_amount]);

  const normalizedPayments = (Array.isArray(payments) ? payments : []).map((entry) => {
    const amountValue = Math.max(toMoneyNumber(entry?.amount), 0);
    const normalizedStatus = normalizeFinanceStatus(entry?.status);
    const dueDateRaw = entry?.due_date || entry?.payment_date || null;
    const dueDateValue = parseLocalDate(dueDateRaw);

    return {
      ...entry,
      amountValue,
      normalizedStatus,
      dueDateRaw,
      dueDateValue,
    };
  });

  const paidFromPayments = normalizedPayments.reduce((acc, entry) => {
    if (!isConfirmedPayment(entry?.status)) return acc;
    return acc + entry.amountValue;
  }, 0);

  const fallbackPaidAmount = Math.max(toMoneyNumber(event?.paid_amount), 0);
  const paidAmount = paidFromPayments > 0 ? paidFromPayments : fallbackPaidAmount;

  const eventOpenAmount = toNonNegativeNumber(event?.open_amount);
  const calculatedOpenAmount = Math.max(totalAmount - paidAmount, 0);
  const openAmount =
    totalAmount > 0 && eventOpenAmount !== null && paidFromPayments <= 0
      ? Math.max(eventOpenAmount, 0)
      : calculatedOpenAmount;

  const computedStatus = calculateEventFinance({
    agreedAmount: totalAmount,
    payments: [{ amount: paidAmount, status: paidAmount > 0 ? 'paid' : 'pending' }],
  }).paymentStatus;

  const statusSource = normalizeFinanceStatus(event?.payment_status);
  const financialStatus = formatFinanceStatusLabel(statusSource || computedStatus);

  const pendingFromPayments = normalizedPayments
    .filter((entry) => {
      if (!entry?.dueDateValue) return false;
      return ['pending', 'partial'].includes(entry.normalizedStatus);
    })
    .sort((a, b) => a.dueDateValue.getTime() - b.dueDateValue.getTime())
    .map((entry, index) => ({
      title: entry?.notes ? `Parcela ${index + 1}` : `Pagamento ${index + 1}`,
      dueDate: formatDateToBR(entry.dueDateRaw),
      amount: entry.amountValue > 0 ? formatCurrencyBRL(entry.amountValue) : 'Não informado',
      status: String(entry.normalizedStatus || 'pending').toUpperCase(),
      description: entry?.notes || '',
    }));

  const signalAmount = Math.max(toMoneyNumber(precontract?.signal_amount), 0);
  const remainingAmount = Math.max(
    toMoneyNumber(precontract?.remaining_amount) || Math.max(totalAmount - signalAmount, 0),
    0
  );
  const signalDueDate = formatDateToBR(precontract?.signal_due_date || event?.signal_due_date);
  const balanceDueDate = formatDateToBR(precontract?.balance_due_date || event?.balance_due_date);

  const fallbackFromPrecontract = [];
  if (signalAmount > 0 && signalDueDate) {
    fallbackFromPrecontract.push({
      title: 'Sinal',
      dueDate: signalDueDate,
      amount: formatCurrencyBRL(signalAmount),
      status: paidAmount >= signalAmount ? 'PAGO' : 'PENDENTE',
      description: 'Pagamento inicial para reserva da data.',
    });
  }

  if (remainingAmount > 0 && balanceDueDate) {
    fallbackFromPrecontract.push({
      title: 'Saldo final',
      dueDate: balanceDueDate,
      amount: formatCurrencyBRL(remainingAmount),
      status: openAmount <= 0 ? 'PAGO' : 'PENDENTE',
      description: 'Pagamento final conforme condições do evento.',
    });
  }

  const vencimentos = pendingFromPayments.length > 0 ? pendingFromPayments : fallbackFromPrecontract;

  const rules = [];
  if (signalDueDate) rules.push(`Sinal previsto para ${signalDueDate}.`);
  if (balanceDueDate) rules.push(`Saldo final previsto para ${balanceDueDate}.`);

  const cardDueDate = formatDateToBR(precontract?.card_due_date || event?.card_due_date);
  if (precontract?.payment_card && cardDueDate) {
    rules.push(`Pagamento em cartão com vencimento em ${cardDueDate}.`);
  } else if (precontract?.payment_card) {
    rules.push('Pagamento via cartão disponível conforme combinado em contrato.');
  }

  if (rules.length === 0) {
    rules.push(
      'Após o envio de comprovante, o pagamento fica em análise até confirmação.',
      'Em caso de dúvidas sobre vencimentos, fale com nossa equipe.'
    );
  }

  return {
    resumo: {
      valorTotal: totalAmount > 0 ? formatCurrencyBRL(totalAmount) : 'Não informado',
      valorPago: paidAmount > 0 ? formatCurrencyBRL(paidAmount) : 'Sem lançamento ainda',
      saldo: totalAmount > 0 ? formatCurrencyBRL(openAmount) : 'Em definição com a equipe',
      status: financialStatus,
      overpaidAmount: null,
    },
    vencimentos,
    regras: rules,
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

function normalizeClientEventType(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!normalized) return '';
  if (normalized.includes('casamento') || normalized.includes('wedding')) return 'casamento';
  if (normalized.includes('cha')) return 'cha';
  if (normalized.includes('show')) return 'show';
  if (normalized.includes('receptivo')) return 'receptivo';
  if (normalized.includes('aniversario')) return 'aniversario';
  if (normalized.includes('corporativo')) return 'corporativo';
  if (normalized.includes('igreja')) return 'igreja';
  return normalized;
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
  const blockMarker = '--- solicitação de ajuste do cliente ---';

  if (
    normalizedObservation === normalizedRequest ||
    normalizedObservation === prefixedRequest
  ) {
    return '';
  }

  const cleanedLines = rawObservation
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const normalizedLine = line.toLowerCase();
      if (normalizedLine === blockMarker) return false;
      if (normalizedLine === normalizedRequest) return false;
      if (normalizedLine === prefixedRequest) return false;
      return true;
    });

  return cleanedLines.join('\n').trim();
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
  const fallbackFinancialData = buildFinancialData({
    event: null,
    precontract: null,
    payments: [],
  });

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
      eventType: 'casamento',
      isWedding: true,
      isCustomEvent: false,
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
        mode: 'wedding',
        selected_styles: [],
        preferred_artists: '',
        custom_songs: [],
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
      ...fallbackFinancialData,
      historico: [],
    },
  };
}

function normalizeClientInitialTab(tabValue) {
  const normalized = String(tabValue || "").trim().toLowerCase();
  if (!normalized) return "inicio";

  const aliases = {
    inicio: "inicio",
    home: "inicio",
    repertorio: "repertorio",
    sugestoes: "sugestoes",
    sugestoeses: "sugestoes",
    financeiro: "financeiro",
    pagamentos: "financeiro",
    pagamento: "financeiro",
  };

  return aliases[normalized] || "inicio";
}

async function fetchPrecontractWithFallback(supabase, matchColumn, matchValue) {
  const primaryResp = await supabase
    .from('precontracts')
    .select(CLIENT_PRECONTRACT_BASE_SELECT_FIELDS)
    .eq(matchColumn, matchValue)
    .maybeSingle();

  if (!primaryResp?.error) return primaryResp;

  console.warn('[CLIENTE PAGE][QUERY_ERROR]', {
    scope: `precontracts.${matchColumn}.primary_select`,
    fields: CLIENT_PRECONTRACT_BASE_SELECT_FIELDS,
    error: primaryResp.error,
  });

  const fallbackResp = await supabase
    .from('precontracts')
    .select(CLIENT_PRECONTRACT_BASE_SELECT_FIELDS_FALLBACK)
    .eq(matchColumn, matchValue)
    .maybeSingle();

  console.log('[CLIENTE PAGE][PRECONTRACT][FALLBACK_SELECT]', {
    scope: `precontracts.${matchColumn}.fallback_select`,
    fields: CLIENT_PRECONTRACT_BASE_SELECT_FIELDS_FALLBACK,
    error: fallbackResp?.error || null,
  });

  if (!fallbackResp?.error) {
    return fallbackResp;
  }

  return primaryResp;
}

export default async function ClienteTokenPage({ params, searchParams }) {
  const { token } = await params;
  const resolvedSearchParams = (await searchParams) || {};
  const initialTab = normalizeClientInitialTab(resolvedSearchParams?.tab);
  const guideQuery = String(resolvedSearchParams?.guide || resolvedSearchParams?.onboarding || '').trim();
  const supabase = getAdminSupabase();
  const normalizedToken = String(token || '').trim();

  console.log('[CLIENTE PAGE][TOKEN]', {
    rawToken: token,
    normalizedToken,
  });
  console.log('[CLIENTE_FINANCE][TOKEN]', {
    rawToken: token,
    normalizedToken,
  });

  if (!supabase) {
    console.info('[CLIENT_PANEL_RENDER]', {
      token: normalizedToken,
      guideQuery,
      loading: false,
      hasData: true,
    });
    console.log('[CLIENTE PAGE][FALLBACK_TRIGGER]', {
      reason: 'SUPABASE_CLIENT_MISSING',
      normalizedToken,
    });
    return <ClienteHome data={buildFallbackData(token)} initialTab={initialTab} guideQuery={guideQuery} />;
  }

  let precontract = null;
  let contractByToken = null;
  let eventId = null;

  try {
    const { data: precontractData, error: precontractError } = await fetchPrecontractWithFallback(
      supabase,
      'public_token',
      normalizedToken
    );

    if (precontractError) {
      console.error('[CLIENTE PAGE][QUERY_ERROR]', {
        scope: 'precontracts.public_token',
        error: precontractError,
      });
    } else {
      precontract = precontractData || null;
      eventId = precontractData?.event_id || null;
    }
    console.log('[CLIENTE PAGE][PRECONTRACT]', {
      error: precontractError || null,
      precontract: precontractData || null,
    });
    console.log('[CLIENTE_FINANCE][PRECONTRACT_RESOLVED]', {
      source: 'precontracts.public_token',
      error: precontractError || null,
      precontractId: precontractData?.id || null,
      eventId: precontractData?.event_id || null,
      publicToken: precontractData?.public_token || null,
    });
    console.log('[CLIENTE PAGE][EVENT_ID]', {
      source: 'precontracts.public_token',
      eventId,
    });
  } catch (error) {
    console.error('[CLIENTE PAGE] Falha inesperada ao buscar precontract:', error);
  }


  if (!eventId && !precontract?.id) {
    try {
      const { data: contractByTokenData, error: contractByTokenError } = await supabase
        .from('contracts')
        .select('id, event_id, precontract_id, public_token, workspace_id, raw_payload')
        .eq('public_token', normalizedToken)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (contractByTokenError) {
        console.error('[CLIENTE PAGE] Erro ao buscar contract por public_token:', contractByTokenError);
      } else {
        contractByToken = contractByTokenData || null;
        eventId = contractByToken?.event_id || null;
      }
      console.log('[CLIENTE PAGE][EVENT_ID]', {
        source: 'contracts.public_token',
        eventId,
        error: contractByTokenError || null,
      });
    } catch (error) {
      console.error('[CLIENTE PAGE] Falha inesperada ao buscar contracts por public_token:', error);
    }
  }

  if (!eventId && !precontract?.id) {
    try {
      const { data: configByToken, error: configByTokenError } = await supabase
        .from('repertoire_config')
        .select('event_id, client_public_token')
        .eq('client_public_token', normalizedToken)
        .maybeSingle();

      if (configByTokenError) {
        console.error(
          '[CLIENTE PAGE] Erro ao buscar repertoire_config por client_public_token:',
          configByTokenError
        );
      } else {
        eventId = configByToken?.event_id || null;
      }
      console.log('[CLIENTE PAGE][EVENT_ID]', {
        source: 'repertoire_config.client_public_token',
        eventId,
        error: configByTokenError || null,
      });
    } catch (error) {
      console.error(
        '[CLIENTE PAGE] Falha inesperada ao buscar repertoire_config por client_public_token:',
        error
      );
    }
  }

  if (!eventId) {
    try {
      const { data: repertoireTokenRow, error: repertoireTokenError } = await supabase
        .from('repertoire_tokens')
        .select('id, token, event_id, status, expires_at')
        .eq('token', normalizedToken)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (repertoireTokenError) {
        console.error('[CLIENTE PAGE] Erro ao buscar repertoire_token:', repertoireTokenError);
      } else {
        eventId = repertoireTokenRow?.event_id || null;
      }
      console.log('[CLIENTE PAGE][EVENT_ID]', {
        source: 'repertoire_tokens.token',
        eventId,
        error: repertoireTokenError || null,
      });
    } catch (error) {
      console.error('[CLIENTE PAGE] Falha inesperada ao buscar repertoire_token:', error);
    }
  }

  if (!precontract?.id && eventId) {
    try {
      const { data: precontractByEvent, error: precontractByEventError } =
        await fetchPrecontractWithFallback(supabase, 'event_id', eventId);

      if (precontractByEventError) {
        console.error('[CLIENTE PAGE][QUERY_ERROR]', {
          scope: 'precontracts.event_id',
          error: precontractByEventError,
        });
      } else {
        precontract = precontractByEvent || null;
      }
      console.log('[CLIENTE PAGE][PRECONTRACT]', {
        source: 'precontracts.event_id',
        error: precontractByEventError || null,
        precontract: precontractByEvent || null,
      });
      console.log('[CLIENTE_FINANCE][PRECONTRACT_RESOLVED]', {
        source: 'precontracts.event_id',
        error: precontractByEventError || null,
        precontractId: precontractByEvent?.id || null,
        eventId: precontractByEvent?.event_id || null,
        publicToken: precontractByEvent?.public_token || null,
      });
    } catch (error) {
      console.error('[CLIENTE PAGE] Falha inesperada ao buscar precontract por event_id:', error);
    }
  }

  const onboardingEventSnapshot =
    contractByToken?.raw_payload?.event_snapshot ||
    contractByToken?.raw_payload?.onboarding_fake_event ||
    contractByToken?.raw_payload?.precontract_snapshot ||
    null;

  const onboardingClientSnapshot =
    contractByToken?.raw_payload?.client_snapshot ||
    contractByToken?.raw_payload?.client_form ||
    null;

  if (precontract?.id) {
    try {
      const { data: precontractFinancialData, error: precontractFinancialError } = await supabase
        .from('precontracts')
        .select(
          'id, agreed_amount, signal_amount, remaining_amount, payment_method, base_amount, add_sound, add_transport, signal_due_date, balance_due_date, card_due_date, payment_card, formation, instruments'
        )
        .eq('id', precontract.id)
        .maybeSingle();

      if (precontractFinancialError) {
        console.warn(
          '[CLIENTE PAGE] Campos financeiros opcionais de precontract indisponíveis, seguindo com fallback seguro:',
          precontractFinancialError
        );
      } else if (precontractFinancialData) {
        precontract = {
          ...precontract,
          ...precontractFinancialData,
        };
      }
    } catch (error) {
      console.warn(
        '[CLIENTE PAGE] Falha inesperada ao buscar campos financeiros opcionais de precontract:',
        error
      );
    }
  }

  if (precontract?.id) {
    try {
      const { data: precontractOptionalData, error: precontractOptionalError } = await supabase
        .from('precontracts')
        .select('id, formation_text, instrument_text, selected_instruments')
        .eq('id', precontract.id)
        .maybeSingle();

      if (precontractOptionalError) {
        console.warn('[CLIENTE PAGE][QUERY_ERROR]', {
          scope: 'precontracts.optional_text_fields',
          error: precontractOptionalError,
        });
      } else if (precontractOptionalData) {
        precontract = {
          ...precontract,
          ...precontractOptionalData,
        };
      }
    } catch (error) {
      console.warn('[CLIENTE PAGE][QUERY_ERROR]', {
        scope: 'precontracts.optional_text_fields',
        error,
      });
    }
  }

  if (!eventId) {
    console.error('[CLIENTE PAGE] Evento não encontrado para token informado:', token);
    console.log('[CLIENTE PAGE][FALLBACK_TRIGGER]', {
      reason: 'EVENT_ID_NOT_FOUND',
      normalizedToken,
    });
    return <ClienteHome data={buildFallbackData(token)} initialTab={initialTab} guideQuery={guideQuery} />;
  }

  let eventResp = { data: null, error: null };
  let configResp = { data: null, error: null };
  let itemsResp = { data: [], error: null };
  let contractsResp = { data: null, error: null };
  let repertoireTokenResp = { data: null, error: null };
  let paymentsResp = { data: [], error: null };
  let pricingResp = { data: null, error: null };
  let adjustmentResp = { data: null, error: null };
  let routeTokenResp = { data: null, error: null };

  const adjustmentQuery = precontract?.id
    ? supabase
        .from('contract_adjustment_requests')
        .select('id, status, request_message, created_at, resolved_at')
        .eq('precontract_id', precontract.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  try {
    routeTokenResp = await supabase
      .from('repertoire_tokens')
      .select('id, token, event_id, status, created_at, expires_at')
      .eq('token', normalizedToken)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    [
      eventResp,
      configResp,
      itemsResp,
      contractsResp,
      repertoireTokenResp,
      paymentsResp,
      pricingResp,
      adjustmentResp,
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
        .from('contracts')
        .select('id, event_id, precontract_id, pdf_url, doc_url, signed_at, raw_payload')
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
        .select('*')
        .eq('event_id', eventId)
        .order('payment_date', { ascending: false }),

      supabase
        .from('pricing_settings')
        .select(CLIENT_PRICING_SELECT_FIELDS)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      adjustmentQuery,
    ]);
  } catch (error) {
    console.error('[CLIENTE PAGE] Falha inesperada ao carregar dados principais:', error);
  }

  console.log('[CLIENTE PAGE][EVENT_RESP]', {
    eventId,
    error: eventResp?.error || null,
    data: eventResp?.data || null,
  });

  if (eventResp?.error) {
    console.log('[CLIENTE PAGE][EVENT_RESP]', {
      retry: 'fallback_select_fields',
      eventId,
      fields: CLIENT_EVENT_SELECT_FIELDS_FALLBACK,
    });
    const fallbackEventResp = await supabase
      .from('events')
      .select(CLIENT_EVENT_SELECT_FIELDS_FALLBACK)
      .eq('id', eventId)
      .maybeSingle();

    console.log('[CLIENTE PAGE][EVENT_RESP]', {
      retry: 'fallback_select_fields_result',
      error: fallbackEventResp?.error || null,
      data: fallbackEventResp?.data || null,
    });

    if (!fallbackEventResp?.error && fallbackEventResp?.data) {
      eventResp = {
        ...fallbackEventResp,
      };
    } else {
      console.log('[CLIENTE PAGE][EVENT_RESP]', {
        retry: 'minimal_fallback_select_fields',
        eventId,
        fields: CLIENT_EVENT_SELECT_FIELDS_MINIMAL_FALLBACK,
      });
      const minimalFallbackEventResp = await supabase
        .from('events')
        .select(CLIENT_EVENT_SELECT_FIELDS_MINIMAL_FALLBACK)
        .eq('id', eventId)
        .maybeSingle();

      console.log('[CLIENTE PAGE][EVENT_RESP]', {
        retry: 'minimal_fallback_select_fields_result',
        error: minimalFallbackEventResp?.error || null,
        data: minimalFallbackEventResp?.data || null,
      });

      if (!minimalFallbackEventResp?.error && minimalFallbackEventResp?.data) {
        eventResp = {
          ...minimalFallbackEventResp,
        };
      }
    }
  }

  if (eventResp?.error) {
    console.error('[CLIENTE PAGE][QUERY_ERROR]', {
      scope: 'events.by_id',
      error: eventResp.error,
    });
  }
  if (configResp?.error) console.error('[CLIENTE PAGE] Erro em repertoire_config:', configResp.error);
  if (itemsResp?.error) console.error('[CLIENTE PAGE] Erro em repertoire_items:', itemsResp.error);
  if (contractsResp?.error) console.error('[CLIENTE PAGE] Erro em contracts:', contractsResp.error);
  if (repertoireTokenResp?.error) {
    console.error('[CLIENTE PAGE] Erro em repertoire_tokens:', repertoireTokenResp.error);
  }
  if (routeTokenResp?.error) {
    console.error('[CLIENTE PAGE] Erro em repertoire_tokens por token da rota:', routeTokenResp.error);
  }
  if (paymentsResp?.error) console.error('[CLIENTE PAGE] Erro em payments:', paymentsResp.error);
  if (pricingResp?.error) {
    console.error('[CLIENTE PAGE] Erro em pricing_settings:', pricingResp.error);
  }
  if (adjustmentResp?.error) {
    console.error('[CLIENTE PAGE] Erro em contract_adjustment_requests:', adjustmentResp.error);
  }

  let event = eventResp?.data || null;
  const config = configResp?.data || null;
  let items = Array.isArray(itemsResp?.data) ? itemsResp.data : [];
  let contract = contractsResp?.data || null;
  if (!contract?.id && precontract?.id) {
    try {
      const contractByPrecontractResp = await supabase
        .from('contracts')
        .select('id, event_id, precontract_id, pdf_url, doc_url, signed_at, raw_payload')
        .eq('precontract_id', precontract.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (contractByPrecontractResp?.error) {
        console.error(
          '[CLIENTE PAGE] Erro ao buscar contract por precontract_id:',
          contractByPrecontractResp.error
        );
      } else if (contractByPrecontractResp?.data) {
        contract = contractByPrecontractResp.data;
      }
    } catch (error) {
      console.error('[CLIENTE PAGE] Falha inesperada ao buscar contract por precontract_id:', error);
    }
  }

  const hasContractedReception = deriveHasContractedReception(config, event, precontract);
  const contractedReceptionHours = deriveContractedReceptionHours(config, event, precontract);
  const repertoireToken = repertoireTokenResp?.data || null;
  const routeToken = routeTokenResp?.data || null;
  let payments = Array.isArray(paymentsResp?.data) ? paymentsResp.data : [];
  const pricing = pricingResp?.data || {};
  const latestAdjustmentRequest = adjustmentResp?.data || null;

  if (event?.id) {
    try {
      const { data: eventOptionalData, error: eventOptionalError } = await supabase
        .from('events')
        .select('id, formation_text, instrument_text')
        .eq('id', event.id)
        .maybeSingle();

      if (eventOptionalError) {
        console.warn('[CLIENTE PAGE][QUERY_ERROR]', {
          scope: 'events.optional_text_fields',
          error: eventOptionalError,
        });
      } else if (eventOptionalData) {
        event = {
          ...event,
          ...eventOptionalData,
        };
      }
    } catch (error) {
      console.warn('[CLIENTE PAGE][QUERY_ERROR]', {
        scope: 'events.optional_text_fields',
        error,
      });
    }
  }

  if (event?.id) {
    try {
      const resolvedPaymentsResp = await supabase
        .from('payments')
        .select('*')
        .eq('event_id', event.id)
        .order('payment_date', { ascending: false });

      if (resolvedPaymentsResp?.error) {
        console.error('[CLIENTE PAGE] Erro ao recarregar payments por event.id:', resolvedPaymentsResp.error);
      } else {
        payments = Array.isArray(resolvedPaymentsResp?.data) ? resolvedPaymentsResp.data : payments;
      }
    } catch (error) {
      console.error('[CLIENTE PAGE] Falha inesperada ao recarregar payments por event.id:', error);
    }
  }

  console.log('[CLIENTE_FINANCE][EVENT_RESOLVED]', {
    eventId: event?.id || eventId || null,
    agreed_amount: event?.agreed_amount ?? null,
    total_price: event?.total_price ?? null,
    amount: event?.amount ?? null,
    paid_amount: event?.paid_amount ?? null,
    amount_paid: event?.amount_paid ?? null,
    open_amount: event?.open_amount ?? null,
    payment_status: event?.payment_status ?? null,
    signal_due_date: event?.signal_due_date ?? null,
    balance_due_date: event?.balance_due_date ?? null,
    card_due_date: event?.card_due_date ?? null,
  });

  console.log('[CLIENTE PAGE][EVENT_DATA]', {
    eventId,
    event,
  });
  console.log('[CLIENTE_FINANCE][CONTRACT_RESOLVED]', {
    contractId: contract?.id || null,
    eventId: contract?.event_id || null,
    precontractId: contract?.precontract_id || null,
    hasRawPayload: Boolean(contract?.raw_payload),
  });
  console.log('[CLIENTE_FINANCE][PAYMENTS_RESOLVED]', {
    resolvedEventId: event?.id || eventId || null,
    count: payments.length,
    statuses: payments.map((entry) => String(entry?.status || '').trim()).filter(Boolean),
  });
  console.log('[CLIENTE PAGE][FINANCE_EVENT_FIELDS]', {
    eventId,
    agreed_amount: event?.agreed_amount ?? null,
    open_amount: event?.open_amount ?? null,
    paid_amount: event?.paid_amount ?? null,
    amount_paid: event?.amount_paid ?? null,
    payment_status: event?.payment_status ?? '',
    total_price: event?.total_price ?? null,
    amount: event?.amount ?? null,
  });
  console.log('[ANTESALA][DB_EVENT_FIELDS]', {
    has_antesala: event?.has_antesala ?? null,
    antesala_enabled: event?.antesala_enabled ?? null,
    antesala_requested_by_client: event?.antesala_requested_by_client ?? null,
    antesala_request_status: event?.antesala_request_status ?? '',
    antesala_duration_minutes: event?.antesala_duration_minutes ?? null,
    antesala_price_increment: event?.antesala_price_increment ?? null,
    has_ante_room: config?.has_ante_room ?? null,
    ante_room_style: config?.ante_room_style ?? '',
    ante_room_notes: config?.ante_room_notes ?? '',
  });
  console.log('[DB_LOAD][EVENT_ID]', eventId);
  console.log('[DB_LOAD][REPERTOIRE_TOKEN]', {
    routeToken: routeToken?.token || null,
    routeTokenId: routeToken?.id || null,
    routeTokenEventId: routeToken?.event_id || null,
    latestEventToken: repertoireToken?.token || null,
    latestEventTokenId: repertoireToken?.id || null,
  });

  if (items.length === 0) {
    const tokenIds = Array.from(
      new Set([routeToken?.id, repertoireToken?.id].filter(Boolean))
    );

    if (tokenIds.length > 0) {
      const fallbackItemsResp = await supabase
        .from('repertoire_items')
        .select(CLIENT_REPERTOIRE_ITEMS_SELECT_FIELDS)
        .in('repertoire_token_id', tokenIds)
        .order('item_order', { ascending: true });

      if (fallbackItemsResp?.error) {
        console.error('[CLIENTE PAGE] Erro no fallback de repertoire_items por repertoire_token_id:', fallbackItemsResp.error);
      } else {
        items = Array.isArray(fallbackItemsResp?.data) ? fallbackItemsResp.data : [];
      }
    }
  }

  const eventSource = event || precontract || onboardingEventSnapshot || null;

  if (!eventSource) {
    console.error('[CLIENTE PAGE] Evento ausente após consultas, renderizando fallback.');
    console.log('[CLIENTE PAGE][FALLBACK_TRIGGER]', {
      reason: 'EVENT_AND_PRECONTRACT_NULL_AFTER_QUERIES',
      eventRespError: eventResp?.error || null,
      eventRespData: eventResp?.data || null,
      eventId,
    });
    return <ClienteHome data={buildFallbackData(token)} initialTab={initialTab} guideQuery={guideQuery} />;
  }

  event = {
    ...(event || {}),
    event_type: event?.event_type || precontract?.event_type || onboardingEventSnapshot?.event_type || 'Casamento',
    event_date: event?.event_date || precontract?.event_date || onboardingEventSnapshot?.event_date || '2026-12-31',
    event_time: event?.event_time || precontract?.event_time || onboardingEventSnapshot?.event_time || '19:00',
    location_name:
      event?.location_name ||
      precontract?.location_name ||
      onboardingEventSnapshot?.location_name ||
      onboardingClientSnapshot?.event_location_name ||
      'Espaço Harmonics Demo',
    location_address:
      event?.location_address ||
      precontract?.location_address ||
      onboardingEventSnapshot?.location_address ||
      onboardingClientSnapshot?.event_location_address ||
      null,
    formation:
      event?.formation ||
      precontract?.formation ||
      onboardingEventSnapshot?.formation ||
      'Quarteto',
    instruments:
      event?.instruments ||
      precontract?.instruments ||
      onboardingEventSnapshot?.instruments ||
      'Voz, Violino, Piano e Cello',
  };

  const sanitizedObservations = sanitizeResolvedAdjustmentFromObservations(
    event?.observations,
    latestAdjustmentRequest
  );

  const configClientToken = String(config?.client_public_token || '').trim();
  const clientToken = configClientToken || token;

  console.log(
    '[DB_LOAD][RAW_ITEMS]',
    (Array.isArray(itemsResp?.data) ? itemsResp.data : []).map((item, index) => ({
      index,
      id: item?.id || null,
      section_raw: item?.section ?? null,
      section_normalized: normalizeRepertoireSection(item?.section),
      item_order: Number(item?.item_order ?? 0),
      label: String(item?.label || item?.who_enters || item?.moment || '').trim(),
      song_name: String(item?.song_name || '').trim(),
      useful: hasUsefulTraceItem(item),
    }))
  );
  console.log('[DB_LOAD][ITEMS_FROM_DB]', items);
  console.log('[DB_LOAD][TOTAL_ITEMS_WITHOUT_USEFUL_FILTER]', items.length);

  if (IS_DEV) {
    console.log('[CLIENTE PAGE] URL PDF contrato:', contract?.pdf_url || '(vazio)');
    console.log(
      '[CLIENTE PAGE] URL PDF repertório:',
      config?.repertoire_pdf_url || '(vazio)'
    );
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
  if (IS_DEV) {
    const cortejoFromDb = items.filter(
      (item) => normalizeRepertoireSection(item.section) === 'cortejo'
    );
    const cerimoniaFromDb = items.filter(
      (item) => normalizeRepertoireSection(item.section) === 'cerimonia'
    );
    const usefulCortejoFromDbCount = cortejoFromDb.filter((item) =>
      hasUsefulTraceItem(item)
    ).length;
    const usefulCerimoniaFromDbCount = cerimoniaFromDb.filter((item) =>
      hasUsefulTraceItem(item)
    ).length;

    console.log('[CLIENTE PAGE][LOAD][ITEMS_FROM_DB]', items);
    console.log('[CLIENTE PAGE][LOAD][CORTEJO_FROM_DB]', cortejoFromDb);
    console.log('[CLIENTE PAGE][LOAD][CERIMONIA_FROM_DB]', cerimoniaFromDb);
    console.log('[TRACE][CORTEJO][DB_LOAD]', pickTraceItemBySection(cortejoFromDb, 'cortejo'));
    console.log('[TRACE][CERIMONIA][DB_LOAD]', pickTraceItemBySection(cerimoniaFromDb, 'cerimonia'));
    console.log('[DB_LOAD][USEFUL_ITEMS_COUNT]', {
      cortejo: usefulCortejoFromDbCount,
      cerimonia: usefulCerimoniaFromDbCount,
    });
    console.log('[CLIENTE PAGE][LOAD][INITIAL_LISTS]', {
      cortejo: initialLists.cortejo,
      cerimonia: initialLists.cerimonia,
      antessala: initialLists.antessala,
      receptivo: initialLists.receptivo,
    });
  }
  const antesalaRequest = resolveAntesalaRequestFromEvent(event);

  const repertorioTokenValue = repertoireToken?.token || token;
  const repertorioPdfToken = clientToken;
  const repertorioPdfUrl = repertorioPdfToken
    ? `/api/cliente/repertorio/pdf/${repertorioPdfToken}`
    : null;
  let eventTypeRow = null;
  if (precontract?.event_type_id) {
    try {
      const eventTypeResp = await supabase
        .from('event_types')
        .select('id, name, slug')
        .eq('id', precontract.event_type_id)
        .maybeSingle();

      if (eventTypeResp?.error) {
        console.warn('[CLIENTE PAGE][QUERY_ERROR]', {
          scope: 'event_types.by_id',
          eventTypeId: precontract.event_type_id,
          error: eventTypeResp.error,
        });
      } else {
        eventTypeRow = eventTypeResp?.data || null;
      }
    } catch (error) {
      console.warn('[CLIENTE PAGE][QUERY_ERROR]', {
        scope: 'event_types.by_id',
        eventTypeId: precontract.event_type_id,
        error,
      });
    }
  }

  const resolvedEventTypeRaw =
    eventTypeRow?.slug ||
    eventTypeRow?.name ||
    precontract?.event_type ||
    event?.event_type ||
    '';

  const normalizedEventType = normalizeClientEventType(resolvedEventTypeRaw);
  const isWedding = normalizedEventType === 'casamento';
  const finalIsWedding = normalizedEventType ? isWedding : true;
  const isCustomEvent = !finalIsWedding;
  const totalEtapas = finalIsWedding ? 7 : 3;
  const etapasPreenchidas = finalIsWedding
    ? computeEtapasPreenchidas(config, items)
    : computeCustomEventStepsFilled(initialLists.customEvent);
  const resolvedEventTitleType =
    (eventTypeRow?.name || eventTypeRow?.slug || precontract?.event_type || event?.event_type || '').trim();
  const eventoTituloPrefix =
    resolvedEventTitleType && resolvedEventTitleType.toLowerCase() !== 'evento'
      ? resolvedEventTitleType
      : 'Evento';

  if (IS_DEV) {
    console.log('[CLIENTE PAGE] token da rota do cliente:', token || '(vazio)');
    console.log('[CLIENTE PAGE] token usado na URL do PDF:', repertorioPdfToken || '(vazio)');
    console.log(
      '[CLIENTE PAGE] tokens da rota e PDF são idênticos?',
      String(token || '') === String(repertorioPdfToken || '')
    );
  }

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
    fileName: '',
    proofUrl: entry.proof_file_url || '',
  }));

  console.log('[CLIENTE PAGE][FINANCE_SUMMARY_INPUT]', {
    eventId,
    event: {
      agreed_amount: event?.agreed_amount ?? null,
      open_amount: event?.open_amount ?? null,
      paid_amount: event?.paid_amount ?? null,
      amount_paid: event?.amount_paid ?? null,
      payment_status: event?.payment_status ?? '',
      total_price: event?.total_price ?? null,
      amount: event?.amount ?? null,
      signal_due_date: event?.signal_due_date ?? null,
      balance_due_date: event?.balance_due_date ?? null,
      card_due_date: event?.card_due_date ?? null,
    },
    precontract: {
      agreed_amount: precontract?.agreed_amount ?? null,
      base_amount: precontract?.base_amount ?? null,
      add_sound: precontract?.add_sound ?? null,
      add_transport: precontract?.add_transport ?? null,
      signal_due_date: precontract?.signal_due_date ?? null,
      balance_due_date: precontract?.balance_due_date ?? null,
      card_due_date: precontract?.card_due_date ?? null,
      payment_card: precontract?.payment_card ?? null,
    },
    paymentsCount: payments.length,
  });

  console.log('[CLIENTE_FINANCE][RAW_SOURCES_DEBUG]', {
    eventId: event?.id,
    eventKeys: event ? Object.keys(event) : [],
    event,
    precontractId: precontract?.id,
    precontractKeys: precontract ? Object.keys(precontract) : [],
    precontract,
    contractId: contract?.id,
    contractRawPayloadKeys: contract?.raw_payload ? Object.keys(contract.raw_payload) : [],
    contractRawPayload: contract?.raw_payload || null,
    paymentsCount: payments.length,
    payments,
  });

  const financialData = buildFinancialData({
    event,
    precontract,
    contract,
    payments,
  });
  console.log('[CLIENTE PAGE][FINANCE_SUMMARY_OUTPUT]', financialData?.resumo || null);
  console.log('[CLIENTE_FINANCE][SUMMARY_BUILT]', {
    token: normalizedToken,
    eventId: event?.id || eventId || null,
    summary: financialData?.resumo || null,
    dueDatesCount: Array.isArray(financialData?.vencimentos) ? financialData.vencimentos.length : 0,
  });

  console.log('[CLIENTE_HOME][FORMATION_SOURCES]', {
    eventFormation: event?.formation,
    eventInstruments: event?.instruments,
    eventFormationText: event?.formation_text,
    eventInstrumentText: event?.instrument_text,
    precontractFormation: precontract?.formation,
    precontractInstruments: precontract?.instruments,
    precontractFormationText: precontract?.formation_text,
    precontractInstrumentText: precontract?.instrument_text,
    precontractRaw: precontract,
  });

  let resolvedFormation =
    event?.formation ||
    precontract?.formation ||
    precontract?.formation_text ||
    '';

  let resolvedInstruments =
    event?.instruments ||
    precontract?.instruments ||
    precontract?.instrument_text ||
    precontract?.selected_instruments ||
    '';

  if (String(resolvedFormation).trim().toLowerCase() === 'solo' && !String(resolvedInstruments).trim()) {
    const soloInstrument =
      extractInstrumentsFromSoloText(event?.formation_text) ||
      extractInstrumentsFromSoloText(precontract?.formation_text) ||
      extractInstrumentsFromSoloText(precontract?.instrument_text) ||
      extractInstrumentsFromSoloText(event?.instrument_text);

    if (soloInstrument) {
      resolvedFormation = 'Solo';
      resolvedInstruments = soloInstrument;
    }
  }

  const receptionHours = Number(
    precontract?.reception_hours ?? event?.reception_hours ?? 0
  ) || 0;
  const receptionFormation =
    event?.reception_formation || precontract?.reception_formation || '';
  const receptionInstruments =
    event?.reception_instruments || precontract?.reception_instruments || '';
  const receptivoResumo = receptionHours > 0
    ? `Receptivo: ${receptionFormation || '—'}${receptionInstruments ? ` (${receptionInstruments})` : ''}`
    : '';

  const resolvedEventSource = event || precontract || {};

  const data = {
    token: clientToken,
    eventId: event?.id || eventId || null,
    clienteNome: resolvedEventSource.client_name || 'Cliente',
    eventoTitulo: resolvedEventSource.client_name
      ? `${eventoTituloPrefix} • ${resolvedEventSource.client_name}`
      : 'Evento',
    dataEvento: resolvedEventSource.event_date || '',
    horarioEvento: resolvedEventSource.event_time || '',
    localEvento:
      resolvedEventSource.location ||
      resolvedEventSource.location_name ||
      resolvedEventSource.event_location_name ||
      '',
    formacao: resolvedFormation,
    instrumentos: resolvedInstruments,
    enderecoEvento:
      resolvedEventSource.location_address ||
      resolvedEventSource.event_location_address ||
      '',
    receptivoResumo,
    statusContrato: contract?.signed_at ? 'Contrato assinado' : 'Contrato pendente',
    contratoPdfUrl: contract?.pdf_url || '',
    contratoDocUrl: contract?.doc_url || '',
    contratoAssinadoEm: contract?.signed_at || null,
    statusEvento: resolvedEventSource.status || 'Confirmado',
    observacoes:
      sanitizedObservations ||
      'Alinhar com a assessoria a ordem correta do cortejo e o roteiro enviado à equipe.',
    horarioChegada: addHoursToTime(resolvedEventSource.event_time, -2),
    suporteWhatsapp: supportConfig.phone,
    suporteWhatsappMensagem: supportConfig.message,
    reviewSubmitted: false,

    repertorio: {
      eventType: normalizedEventType || resolvedEventTypeRaw || 'casamento',
      isWedding: finalIsWedding,
      isCustomEvent,
      status: mapStatusToUi(config?.status, config?.is_locked),
      isLocked: Boolean(config?.is_locked),
      etapasPreenchidas,
      totalEtapas,
      liberadoParaEdicao: !config?.is_locked,
      enviadoEm: config?.submitted_at || null,
      linkPreenchimento: `/cliente/${clientToken}/repertorio`,
      linkVisualizacao: `/cliente/${clientToken}/repertorio`,
      podeSolicitarCorrecao:
        String(config?.status || '').toUpperCase() !== 'AGUARDANDO_REVISAO',
      temAntessala: Boolean(
        config?.has_ante_room ??
          event?.has_antesala ??
          event?.antesala_enabled ??
          false
      ),
      antesalaDurationMinutes:
        Number(event?.antesala_duration_minutes ?? 0) || null,
      antesalaRequestedByClient: antesalaRequest.requestedByClient,
      antesalaRequestStatus: antesalaRequest.status,
      antesalaPriceIncrement: Number(event?.antesala_price_increment || 0),
      antesalaQuoteOptions: buildAntesalaQuoteOptions(event?.formation, pricing),
      temReceptivo: Boolean(hasContractedReception),
      receptivoContratadoHoras: contractedReceptionHours || 0,
      receptivoDuracaoTravada: Boolean(hasContractedReception),
      pdfUrl: repertorioPdfUrl,
      repertoireToken: repertorioTokenValue,

      initialState: {
        mode: finalIsWedding ? 'wedding' : 'custom',
        selected_styles: initialLists.customEvent?.selected_styles || [],
        preferred_artists: initialLists.customEvent?.preferred_artists || '',
        custom_songs: initialLists.customEvent?.custom_songs || [],
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
          requestedByClient: antesalaRequest.requestedByClient,
          requestStatus: antesalaRequest.status,
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
      ...financialData,
      historico: paymentHistory,
    },
  };

  console.log('[ANTESALA_REOPEN][DB_VALUES]', {
    eventId,
    has_antesala: event?.has_antesala ?? null,
    antesala_enabled: event?.antesala_enabled ?? null,
    antesala_requested_by_client: event?.antesala_requested_by_client ?? null,
    antesala_request_status: event?.antesala_request_status ?? '',
    antesala_duration_minutes: event?.antesala_duration_minutes ?? null,
    antesala_price_increment: event?.antesala_price_increment ?? null,
    has_ante_room: config?.has_ante_room ?? null,
    ante_room_style: config?.ante_room_style ?? '',
    ante_room_notes: config?.ante_room_notes ?? '',
    initial_antessala: data?.repertorio?.initialState?.antessala ?? null,
  });

  console.log('[ANTESALA][INITIAL_STATE_FROM_DB]', {
    has_antesala: event?.has_antesala ?? null,
    antesala_enabled: event?.antesala_enabled ?? null,
    antesala_requested_by_client: event?.antesala_requested_by_client ?? null,
    antesala_request_status: event?.antesala_request_status ?? '',
    antesala_duration_minutes: event?.antesala_duration_minutes ?? null,
    antesala_price_increment: event?.antesala_price_increment ?? null,
    has_ante_room: config?.has_ante_room ?? null,
    ante_room_style: config?.ante_room_style ?? '',
    ante_room_notes: config?.ante_room_notes ?? '',
    querAntessala: data?.repertorio?.initialState?.querAntessala ?? null,
    requestedByClient:
      data?.repertorio?.initialState?.antessala?.requestedByClient ?? false,
    requestStatus: data?.repertorio?.initialState?.antessala?.requestStatus ?? '',
    durationMinutes:
      data?.repertorio?.initialState?.antessala?.durationMinutes ?? null,
    quoteMinutes: data?.repertorio?.initialState?.antessala?.quoteMinutes ?? null,
    quotePriceIncrement:
      data?.repertorio?.initialState?.antessala?.quotePriceIncrement ?? 0,
    included: data?.repertorio?.temAntessala ?? false,
    priceIncrement: data?.repertorio?.antesalaPriceIncrement ?? 0,
  });

  if (IS_DEV) {
    const usefulInitialCortejoCount = (
      data?.repertorio?.initialState?.cortejo || []
    ).filter((item) => hasUsefulTraceItem(item)).length;
    const usefulInitialCerimoniaCount = (
      data?.repertorio?.initialState?.cerimonia || []
    ).filter((item) => hasUsefulTraceItem(item)).length;
    console.log('[CLIENTE PAGE][LOAD][INITIAL_STATE]', {
      cortejo: data?.repertorio?.initialState?.cortejo,
      cerimonia: data?.repertorio?.initialState?.cerimonia,
      fullInitialState: data?.repertorio?.initialState,
    });
    console.log(
      '[TRACE][CORTEJO][INITIAL_STATE]',
      pickTraceItemBySection(data?.repertorio?.initialState?.cortejo, 'cortejo')
    );
    console.log(
      '[TRACE][CERIMONIA][INITIAL_STATE]',
      pickTraceItemBySection(data?.repertorio?.initialState?.cerimonia, 'cerimonia')
    );
    console.log('[INITIAL_STATE][USEFUL_ITEMS_COUNT]', {
      cortejo: usefulInitialCortejoCount,
      cerimonia: usefulInitialCerimoniaCount,
    });
  }

  console.log('[CLIENTE PAGE][FINAL_DATA]', {
    token: data.token,
    clienteNome: data.clienteNome,
    dataEvento: data.dataEvento,
    horarioEvento: data.horarioEvento,
    localEvento: data.localEvento,
    formacao: data.formacao,
    instrumentos: data.instrumentos,
    statusEvento: data.statusEvento,
    fullData: data,
  });

  const shouldShowGuide = guideQuery === 'client-panel';
  console.info('[CLIENT_PANEL_GUIDE_INIT]', {
    token: normalizedToken,
    guideQuery,
    hasContract: Boolean(contract?.id || contractByToken?.id),
    hasPrecontract: Boolean(precontract?.id),
    hasEvent: Boolean(event?.id || eventId),
    loading: false,
    shouldShowGuide,
  });

  console.info('[CLIENT_PANEL_RENDER]', {
    token: normalizedToken,
    guideQuery,
    loading: false,
    hasData: Boolean(data),
  });

  return <ClienteHome data={data} initialTab={initialTab} guideQuery={guideQuery} />;
}
