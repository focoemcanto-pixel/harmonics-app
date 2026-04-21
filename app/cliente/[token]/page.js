import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import ClienteHome from '../../../components/cliente/ClienteHome';
import { resolveSupportWhatsAppConfig } from '../../../lib/whatsapp/support-config';

const IS_DEV = process.env.NODE_ENV !== 'production';
const CLIENT_EVENT_SELECT_FIELDS = [
  'id',
  'client_name',
  'event_date',
  'event_time',
  'location_name',
  'formation',
  'instruments',
  'status',
  'observations',
  'agreed_amount',
  'paid_amount',
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
  'event_date',
  'event_time',
  'location_name',
  'formation',
  'instruments',
  'status',
  'observations',
  'agreed_amount',
  'open_amount',
  'paid_amount',
  'payment_status',
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
  'event_date',
  'event_time',
  'location_name',
  'formation',
  'instruments',
  'status',
  'observations',
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

function normalizePaymentStatus(status = '') {
  const raw = String(status || '').trim().toLowerCase();
  if (['confirmed', 'confirmado', 'paid', 'pago'].includes(raw)) return 'PAGO';
  if (['pending', 'pendente'].includes(raw)) return 'PENDENTE';
  if (['cancelled', 'cancelado', 'canceled'].includes(raw)) return 'CANCELADO';
  if (['em_analise', 'analyzing', 'analysis'].includes(raw)) return 'EM_ANALISE';
  return raw ? raw.toUpperCase() : '';
}

function buildFinancialData({ event, precontract, contract, payments = [] }) {
  const contractRawPayload = contract?.raw_payload || {};
  const contractSnapshotAmount = pickFirstPositiveNumber([
    contractRawPayload?.precontract_snapshot?.agreed_amount,
    contractRawPayload?.event_snapshot?.agreed_amount,
    contractRawPayload?.agreed_amount,
    contractRawPayload?.client_form?.agreed_amount,
  ]);

  if (contractSnapshotAmount > 0) {
    console.log('[CLIENTE PAGE][FINANCE_CONTRACT_VALUE_FALLBACK]', {
      contractId: contract?.id || null,
      source: 'contracts.raw_payload snapshot/agreed_amount',
      value: contractSnapshotAmount,
    });
  }

  const precontractComposedAmount =
    toPositiveNumber(precontract?.base_amount) +
    toPositiveNumber(precontract?.add_sound) +
    toPositiveNumber(precontract?.add_transport);

  const totalValueCandidates = [
    {
      source: 'events.agreed_amount',
      value: event?.agreed_amount,
    },
    {
      source: 'events.total_price',
      value: event?.total_price,
    },
    {
      source: 'events.amount',
      value: event?.amount,
    },
    {
      source: 'precontracts.agreed_amount',
      value: precontract?.agreed_amount,
    },
    {
      source: 'contracts.raw_payload snapshot/agreed_amount',
      value: contractSnapshotAmount,
    },
    {
      source: 'precontracts.base_amount+add_sound+add_transport',
      value: precontractComposedAmount,
    },
  ];

  const totalValueResolution = totalValueCandidates.find(
    (candidate) => toPositiveNumber(candidate.value) > 0
  ) || { source: 'none', value: 0 };

  console.log('[CLIENTE PAGE][FINANCE_VALUE_SOURCE]', {
    selectedSource: totalValueResolution.source,
    selectedValue: toPositiveNumber(totalValueResolution.value),
    candidates: totalValueCandidates.map((candidate) => ({
      source: candidate.source,
      value: toPositiveNumber(candidate.value),
    })),
  });

  const baseTotalAmount = toPositiveNumber(totalValueResolution.value);
  const hasApprovedAntesala = Boolean(
    event?.has_antesala ??
      event?.antesala_enabled ??
      false
  );
  const beforeRoomIncrement =
    hasApprovedAntesala ? toPositiveNumber(event?.antesala_price_increment) : 0;
  const totalAmount = baseTotalAmount + beforeRoomIncrement;

  const normalizedPayments = (Array.isArray(payments) ? payments : []).map((entry) => {
    const normalizedStatus = normalizePaymentStatus(entry?.status);
    return {
      ...entry,
      normalizedStatus,
      amountValue: toPositiveNumber(entry?.amount),
      paymentDateValue: parseLocalDate(entry?.payment_date),
    };
  });

  const confirmedPaidFromPayments = normalizedPayments.reduce((acc, entry) => {
    if (entry.normalizedStatus === 'PAGO') return acc + entry.amountValue;
    return acc;
  }, 0);

  const paidAmount = Math.max(
    pickFirstPositiveNumber([event?.paid_amount, event?.amount_paid]),
    confirmedPaidFromPayments
  );

  const openAmountFromEvent = toNonNegativeNumber(event?.open_amount);
  const rawSaldo = openAmountFromEvent ?? totalAmount - paidAmount;
  const saldoAmount = Math.max(rawSaldo, 0);
  const normalizedEventPaymentStatus = normalizePaymentStatus(event?.payment_status);

  let financialStatus = 'Consulte a equipe';
  if (normalizedEventPaymentStatus === 'PAGO') {
    financialStatus = 'Pago';
  } else if (normalizedEventPaymentStatus === 'PENDENTE') {
    financialStatus = 'Pagamento pendente';
  } else if (normalizedEventPaymentStatus === 'EM_ANALISE') {
    financialStatus = 'Em análise';
  } else if (totalAmount > 0) {
    if (paidAmount <= 0) financialStatus = 'Pagamento pendente';
    else if (rawSaldo <= 0) financialStatus = 'Pago';
    else financialStatus = 'Parcialmente pago';
  } else if (paidAmount > 0) {
    financialStatus = 'Parcialmente pago';
  }

  const upcomingFromPayments = normalizedPayments
    .filter((entry) => {
      if (!entry.paymentDateValue) return false;
      if (entry.normalizedStatus === 'PAGO' || entry.normalizedStatus === 'CANCELADO') return false;
      return true;
    })
    .sort((a, b) => a.paymentDateValue.getTime() - b.paymentDateValue.getTime())
    .map((entry, index) => ({
      title: entry?.notes ? `Parcela ${index + 1}` : `Pagamento ${index + 1}`,
      dueDate: formatDateToBR(entry.payment_date),
      amount: entry.amountValue > 0 ? formatCurrencyBRL(entry.amountValue) : 'Não informado',
      status: entry.normalizedStatus || 'PENDENTE',
      description: entry?.notes || '',
    }));

  const eventDate = parseLocalDate(event?.event_date);
  const fallbackSignalDate = eventDate ? formatDateToBR(addDays(eventDate, -14)) : '';
  const fallbackBalanceDate = eventDate ? formatDateToBR(addDays(eventDate, -2)) : '';

  const explicitSignalDueDate = formatDateToBR(precontract?.signal_due_date || event?.signal_due_date);
  const explicitBalanceDueDate = formatDateToBR(precontract?.balance_due_date || event?.balance_due_date);

  const explicitVencimentos = [];
  if (explicitSignalDueDate) {
    explicitVencimentos.push({
      title: 'Sinal',
      dueDate: explicitSignalDueDate,
      amount: totalAmount > 0 ? formatCurrencyBRL(totalAmount / 2) : 'Não informado',
      status: paidAmount > 0 ? 'PAGO' : 'PENDENTE',
      description: 'Pagamento inicial para reserva da data.',
    });
  }

  if (explicitBalanceDueDate) {
    explicitVencimentos.push({
      title: 'Saldo final',
      dueDate: explicitBalanceDueDate,
      amount: saldoAmount > 0 ? formatCurrencyBRL(saldoAmount) : formatCurrencyBRL(0),
      status: saldoAmount <= 0 && totalAmount > 0 ? 'PAGO' : 'PENDENTE',
      description: 'Pagamento final conforme condições do evento.',
    });
  }

  const fallbackVencimentos =
    totalAmount > 0
      ? [
          {
            title: 'Primeira parcela',
            dueDate: explicitSignalDueDate || fallbackSignalDate || 'Não informado',
            amount: formatCurrencyBRL(totalAmount / 2),
            status: paidAmount >= totalAmount / 2 ? 'PAGO' : 'PENDENTE',
            description: '50% do valor total até 14 dias antes do evento.',
          },
          {
            title: 'Parcela final',
            dueDate: explicitBalanceDueDate || fallbackBalanceDate || 'Não informado',
            amount: formatCurrencyBRL(Math.max(totalAmount - totalAmount / 2, 0)),
            status: saldoAmount <= 0 ? 'PAGO' : 'PENDENTE',
            description: 'Saldo final até 48 horas antes do evento.',
          },
        ]
      : [];

  const vencimentos =
    upcomingFromPayments.length > 0
      ? upcomingFromPayments
      : explicitVencimentos.length > 0
      ? explicitVencimentos
      : fallbackVencimentos;

  const rules = [];

  if (explicitSignalDueDate) {
    rules.push(`Sinal previsto para ${explicitSignalDueDate}.`);
  }
  if (explicitBalanceDueDate) {
    rules.push(`Saldo final previsto para ${explicitBalanceDueDate}.`);
  }

  const cardDueDate = formatDateToBR(precontract?.card_due_date || event?.card_due_date);
  if (precontract?.payment_card && cardDueDate) {
    rules.push(`Pagamento em cartão com vencimento em ${cardDueDate}.`);
  } else if (precontract?.payment_card) {
    rules.push('Pagamento via cartão disponível conforme combinado em contrato.');
  }

  if (rules.length === 0) {
    rules.push(
      '50% do valor deve ser quitado até 14 dias antes do evento.',
      'O saldo final deve ser quitado até 48 horas antes da data do evento.',
      'Após o envio de comprovante, o pagamento fica em análise até confirmação.'
    );
  }

  return {
    resumo: {
      valorTotal: totalAmount > 0 ? formatCurrencyBRL(totalAmount) : 'Não informado',
      valorPago: paidAmount > 0 ? formatCurrencyBRL(paidAmount) : 'Sem lançamento ainda',
      saldo: totalAmount > 0 ? formatCurrencyBRL(saldoAmount) : 'Em definição com a equipe',
      status: financialStatus,
      overpaidAmount: rawSaldo < 0 ? formatCurrencyBRL(Math.abs(rawSaldo)) : null,
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

export default async function ClienteTokenPage({ params }) {
  const { token } = await params;
  const supabase = getAdminSupabase();
  const normalizedToken = String(token || '').trim();

  console.log('[CLIENTE PAGE][TOKEN]', {
    rawToken: token,
    normalizedToken,
  });

  if (!supabase) {
    console.log('[CLIENTE PAGE][FALLBACK_TRIGGER]', {
      reason: 'SUPABASE_CLIENT_MISSING',
      normalizedToken,
    });
    return <ClienteHome data={buildFallbackData(token)} />;
  }

  let precontract = null;
  let eventId = null;

  try {
    const { data: precontractData, error: precontractError } = await supabase
      .from('precontracts')
      .select('id, public_token, event_id, reception_hours, has_sound, has_transport')
      .eq('public_token', normalizedToken)
      .maybeSingle();

    if (precontractError) {
      console.error('[CLIENTE PAGE] Erro ao buscar precontract:', precontractError);
    } else {
      precontract = precontractData || null;
      eventId = precontractData?.event_id || null;
    }
    console.log('[CLIENTE PAGE][PRECONTRACT]', {
      error: precontractError || null,
      precontract: precontractData || null,
    });
    console.log('[CLIENTE PAGE][EVENT_ID]', {
      source: 'precontracts.public_token',
      eventId,
    });
  } catch (error) {
    console.error('[CLIENTE PAGE] Falha inesperada ao buscar precontract:', error);
  }

  if (!eventId) {
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
      const { data: precontractByEvent, error: precontractByEventError } = await supabase
        .from('precontracts')
        .select('id, public_token, event_id, reception_hours, has_sound, has_transport')
        .eq('event_id', eventId)
        .maybeSingle();

      if (precontractByEventError) {
        console.error('[CLIENTE PAGE] Erro ao buscar precontract por event_id:', precontractByEventError);
      } else {
        precontract = precontractByEvent || null;
      }
      console.log('[CLIENTE PAGE][PRECONTRACT]', {
        source: 'precontracts.event_id',
        error: precontractByEventError || null,
        precontract: precontractByEvent || null,
      });
    } catch (error) {
      console.error('[CLIENTE PAGE] Falha inesperada ao buscar precontract por event_id:', error);
    }
  }

  if (precontract?.id) {
    try {
      const { data: precontractFinancialData, error: precontractFinancialError } = await supabase
        .from('precontracts')
        .select(
          'id, agreed_amount, base_amount, add_sound, add_transport, signal_due_date, balance_due_date, card_due_date, payment_card'
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

  if (!eventId) {
    console.error('[CLIENTE PAGE] Evento não encontrado para token informado:', token);
    console.log('[CLIENTE PAGE][FALLBACK_TRIGGER]', {
      reason: 'EVENT_ID_NOT_FOUND',
      normalizedToken,
    });
    return <ClienteHome data={buildFallbackData(token)} />;
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
        .select('id, amount, payment_date, payment_method, status, notes, proof_file_url')
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

  if (eventResp?.error) console.error('[CLIENTE PAGE] Erro em events:', eventResp.error);
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

  const event = eventResp?.data || null;
  const config = configResp?.data || null;
  let items = Array.isArray(itemsResp?.data) ? itemsResp.data : [];
  const contract = contractsResp?.data || null;
  const hasContractedReception = deriveHasContractedReception(config, event, precontract);
  const contractedReceptionHours = deriveContractedReceptionHours(config, event, precontract);
  const repertoireToken = repertoireTokenResp?.data || null;
  const routeToken = routeTokenResp?.data || null;
  const payments = Array.isArray(paymentsResp?.data) ? paymentsResp.data : [];
  const pricing = pricingResp?.data || {};
  const latestAdjustmentRequest = adjustmentResp?.data || null;

  console.log('[CLIENTE PAGE][EVENT_DATA]', {
    eventId,
    event,
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

  if (!event) {
    console.error('[CLIENTE PAGE] Evento ausente após consultas, renderizando fallback.');
    console.log('[CLIENTE PAGE][FALLBACK_TRIGGER]', {
      reason: 'EVENT_NULL_AFTER_QUERIES',
      eventRespError: eventResp?.error || null,
      eventRespData: eventResp?.data || null,
      eventId,
    });
    return <ClienteHome data={buildFallbackData(token)} />;
  }

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

  const financialData = buildFinancialData({
    event,
    precontract,
    contract,
    payments,
  });
  console.log('[CLIENTE PAGE][FINANCE_SUMMARY_OUTPUT]', financialData?.resumo || null);

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

  return <ClienteHome data={data} />;
}
