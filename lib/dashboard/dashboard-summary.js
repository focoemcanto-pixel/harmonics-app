import { toNumber } from '../eventos/eventos-format';

function normalizeStatus(value) {
  return String(value || '').trim().toUpperCase();
}

function isReviewRequestedStatus(status) {
  return (
    status === 'AGUARDANDO_REVISAO' ||
    status === 'REVISAO_SOLICITADA' ||
    status === 'REVIEW_REQUESTED'
  );
}

function getDateStart(dateStr) {
  if (!dateStr) return null;
  const parsed = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pickFirstResolved(options = []) {
  for (const option of options) {
    const rawValue = option?.value;
    const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
    if (value) {
      return {
        value,
        source: option?.source || 'desconhecido',
      };
    }
  }

  return {
    value: null,
    source: null,
  };
}

function normalizeDateValue(value) {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return raw;

  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

function isSameMonth(dateStr, refDate = new Date()) {
  if (!dateStr) return false;

  const d = new Date(`${dateStr}T00:00:00`);
  return (
    d.getMonth() === refDate.getMonth() &&
    d.getFullYear() === refDate.getFullYear()
  );
}

function isUpcoming(dateStr, days = 7) {
  if (!dateStr) return false;

  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const target = new Date(`${dateStr}T00:00:00`);

  const diff = (target - start) / (1000 * 60 * 60 * 24);

  return diff >= 0 && diff <= days;
}

export function buildDashboardSummary(
  events = [],
  contracts = [],
  precontracts = [],
  eventMusicians = [],
  repertoireConfigs = []
) {
  const now = new Date();

  const eventosMes = events.filter((ev) => isSameMonth(ev.event_date, now));

  const bruto = eventosMes.reduce(
    (acc, ev) => acc + toNumber(ev.agreed_amount),
    0
  );

  const recebido = eventosMes.reduce(
    (acc, ev) => acc + toNumber(ev.paid_amount),
    0
  );

  const emAberto = eventosMes.reduce(
    (acc, ev) => acc + toNumber(ev.open_amount),
    0
  );

  const liquido = eventosMes.reduce(
    (acc, ev) => acc + toNumber(ev.profit_amount),
    0
  );

  const proximos = events.filter((ev) => isUpcoming(ev.event_date, 7)).length;

  const pagamentosPendentes = events.filter(
    (ev) => toNumber(ev.open_amount) > 0
  ).length;

  const contratosPendentes = precontracts.filter((pc) => {
    const status = normalizeStatus(pc.status);
    return status !== 'SIGNED' && status !== 'CANCELLED';
  }).length;

  const precontractsAtivos = precontracts.filter((pc) => {
    const status = normalizeStatus(pc.status);
    return status !== 'SIGNED' && status !== 'CANCELLED';
  }).length;

  const escalasPendentes = eventMusicians.filter((item) => {
    const status = normalizeStatus(item.status);
    return status === 'PENDING' || status === 'PENDENTE';
  }).length;

  const escalasIncompletas = eventMusicians.filter((item) => {
    const status = normalizeStatus(item.status);
    return (
      status === 'PENDING' ||
      status === 'PENDENTE' ||
      status === 'DECLINED' ||
      status === 'RECUSADO'
    );
  }).length;

  const repertoriosAguardandoAcao = repertoireConfigs.filter((cfg) => {
    const status = normalizeStatus(cfg.status);

    if (status === 'FINALIZADO') return false;

    if (cfg.is_locked && cfg.submitted_at && status !== 'REVISAO_SOLICITADA') {
      return false;
    }

    return true;
  }).length;

  const revisoesSolicitadas = repertoireConfigs.filter((cfg) =>
    isReviewRequestedStatus(normalizeStatus(cfg.status))
  ).length;

  const eventsById = new Map(events.map((event) => [String(event.id), event]));
  const precontractsByEventId = new Map(
    precontracts
      .filter((item) => item?.event_id)
      .map((item) => [String(item.event_id), item])
  );
  const precontractsById = new Map(
    precontracts
      .filter((item) => item?.id)
      .map((item) => [String(item.id), item])
  );
  const contractsByEventId = new Map(
    contracts
      .filter((item) => item?.event_id)
      .map((item) => [String(item.event_id), item])
  );
  const contractsByPrecontractId = new Map(
    contracts
      .filter((item) => item?.precontract_id)
      .map((item) => [String(item.precontract_id), item])
  );
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const reviewCandidates = repertoireConfigs
    .filter((cfg) => isReviewRequestedStatus(normalizeStatus(cfg.status)))
    .map((cfg) => {
      const eventId = cfg.event_id ? String(cfg.event_id) : null;
      const event = eventsById.get(String(cfg.event_id || ''));
      const precontractFromEvent = precontractsByEventId.get(String(cfg.event_id || ''));
      const contractFromEvent = contractsByEventId.get(String(cfg.event_id || ''));
      const contractFromPrecontract = precontractFromEvent
        ? contractsByPrecontractId.get(String(precontractFromEvent.id))
        : null;
      const precontractFromContract = contractFromEvent?.precontract_id
        ? precontractsById.get(String(contractFromEvent.precontract_id))
        : null;
      const contract = contractFromEvent || contractFromPrecontract || null;
      const precontract = precontractFromEvent || precontractFromContract || null;

      const clientResolution = pickFirstResolved([
        { value: event?.client_name, source: 'events.client_name' },
        { value: precontract?.client_name, source: 'precontracts.client_name' },
        { value: contract?.client_name, source: 'contracts.client_name' },
        {
          value: contract?.raw_payload?.client_form?.full_name,
          source: 'contracts.raw_payload.client_form.full_name',
        },
        {
          value: contract?.raw_payload?.client_form?.client_name,
          source: 'contracts.raw_payload.client_form.client_name',
        },
        { value: contract?.raw_payload?.client_name, source: 'contracts.raw_payload.client_name' },
      ]);

      const eventDateResolution = pickFirstResolved([
        { value: event?.event_date, source: 'events.event_date' },
        { value: precontract?.event_date, source: 'precontracts.event_date' },
        { value: contract?.event_date, source: 'contracts.event_date' },
        {
          value: contract?.raw_payload?.client_form?.event_date,
          source: 'contracts.raw_payload.client_form.event_date',
        },
        { value: contract?.raw_payload?.event_date, source: 'contracts.raw_payload.event_date' },
      ]);

      const eventDate = normalizeDateValue(eventDateResolution.value);
      const parsedDate = getDateStart(eventDate);

      return {
        eventId: event?.id || cfg.event_id || null,
        configId: cfg.id || null,
        clientName: clientResolution.value,
        clientNameSource: clientResolution.source,
        eventDate,
        eventDateSource: eventDateResolution.source,
        parsedDate,
        sourceSnapshot: {
          eventId,
          hasEvent: !!event,
          hasPrecontract: !!precontract,
          hasContract: !!contract,
        },
      };
    })
    .filter((candidate) => candidate.parsedDate);

  reviewCandidates.sort((a, b) => {
    const aIsFuture = a.parsedDate >= startOfToday;
    const bIsFuture = b.parsedDate >= startOfToday;

    if (aIsFuture && !bIsFuture) return -1;
    if (!aIsFuture && bIsFuture) return 1;

    return a.parsedDate - b.parsedDate;
  });

  const revisaoSolicitadaMaisUrgente = reviewCandidates[0] || null;

  return {
    bruto,
    liquido,
    recebido,
    emAberto,

    eventosMes: eventosMes.length,
    proximos,
    contratosPendentes,
    precontractsAtivos,
    pagamentosPendentes,
    escalasPendentes,
    escalasIncompletas,
    repertoriosAguardandoAcao,
    revisoesSolicitadas,
    revisaoSolicitadaMaisUrgente,
  };
}
