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
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const reviewCandidates = repertoireConfigs
    .filter((cfg) => isReviewRequestedStatus(normalizeStatus(cfg.status)))
    .map((cfg) => {
      const event = eventsById.get(String(cfg.event_id || ''));
      const eventDate = event?.event_date || null;
      const parsedDate = getDateStart(eventDate);

      return {
        eventId: event?.id || cfg.event_id || null,
        clientName: event?.client_name || null,
        eventDate,
        parsedDate,
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
