import { toNumber } from '../eventos/eventos-format';

function normalizeStatus(value) {
  return String(value || '').trim().toUpperCase();
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
  };
}
