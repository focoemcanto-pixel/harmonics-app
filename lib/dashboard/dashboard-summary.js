import { toNumber } from '../eventos/eventos-format';

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
  const target = new Date(`${dateStr}T00:00:00`);

  const diff = (target - today) / (1000 * 60 * 60 * 24);

  return diff >= 0 && diff <= days;
}

export function buildDashboardSummary(
  events = [],
  contracts = [],
  precontracts = [],
  escalas = []
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
    const status = String(pc.status || '').toLowerCase();
    return status !== 'signed' && status !== 'cancelled';
  }).length;

  const precontractsAtivos = precontracts.filter((pc) => {
    const status = String(pc.status || '').toLowerCase();
    return status !== 'signed' && status !== 'cancelled';
  }).length;

  const escalasPendentes = Array.isArray(escalas)
    ? escalas.filter((item) => {
        const status = String(item?.status || '').toLowerCase();
        return status === 'pending' || status === 'pendente';
      }).length
    : 0;

  return {
    bruto,
    liquido,
    recebido,
    emAberto,

    eventosMes: eventosMes.length,
    proximos,
    contratosPendentes,
    pagamentosPendentes,
    precontractsAtivos,
    escalasPendentes,
  };
}
