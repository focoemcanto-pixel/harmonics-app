function toNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  const normalized = raw
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function isSettledPaymentStatus(status) {
  const raw = normalizeStatus(status);
  return ['confirmed', 'confirmado', 'paid', 'pago'].includes(raw);
}

function isRejectedStatus(status) {
  const raw = normalizeStatus(status);
  return ['rejected', 'rejeitado', 'cancelado', 'cancelled', 'canceled'].includes(raw);
}

function isPendingValidationStatus(status) {
  const raw = normalizeStatus(status);
  return [
    'em_analise',
    'em análise',
    'analysis',
    'analyzing',
    'pending_admin_validation',
    'admin_review',
    'pending_confirmation',
    'aguardando_validacao',
    'aguardando validação',
    'pendente_validacao',
  ].includes(raw);
}

export function calculateFinancialSummary(events = [], payments = [], options = {}) {
  const onError = typeof options?.onError === 'function' ? options.onError : console.error;

  const receitaContratada = events.reduce((acc, ev) => acc + toNumber(ev?.agreed_amount), 0);

  const recebido = payments.reduce((acc, payment) => {
    if (isRejectedStatus(payment?.status)) return acc;
    if (!isSettledPaymentStatus(payment?.status)) return acc;
    return acc + toNumber(payment?.amount);
  }, 0);

  const emAberto = Math.max(receitaContratada - recebido, 0);

  const custosTotais = events.reduce((acc, ev) => {
    return (
      acc +
      toNumber(ev?.musician_cost) +
      toNumber(ev?.sound_cost) +
      toNumber(ev?.extra_transport_cost) +
      toNumber(ev?.other_cost)
    );
  }, 0);

  let lucroPrevisto = receitaContratada - custosTotais;

  if (lucroPrevisto > receitaContratada) {
    onError('[FINANCE_SUMMARY_ERROR] lucroPrevisto maior que receitaContratada', {
      lucroPrevisto,
      receitaContratada,
      custosTotais,
    });
    lucroPrevisto = receitaContratada - custosTotais;
  }

  const receivedByEventId = payments.reduce((acc, payment) => {
    if (isRejectedStatus(payment?.status)) return acc;
    if (!isSettledPaymentStatus(payment?.status)) return acc;

    const eventId = String(payment?.event_id || '').trim();
    if (!eventId) return acc;

    acc.set(eventId, (acc.get(eventId) || 0) + toNumber(payment?.amount));
    return acc;
  }, new Map());

  const paymentCounts = events.reduce(
    (acc, ev) => {
      const eventId = String(ev?.id || '').trim();
      const agreed = toNumber(ev?.agreed_amount);
      const paid = receivedByEventId.get(eventId) || 0;

      if (agreed > 0 && paid >= agreed) {
        acc.pagos += 1;
      } else if (paid > 0) {
        acc.parciais += 1;
      } else {
        acc.pendentes += 1;
      }

      return acc;
    },
    { pagos: 0, parciais: 0, pendentes: 0 }
  );

  const comprovantesEmValidacao = payments.filter((payment) =>
    isPendingValidationStatus(payment?.status)
  ).length;

  return {
    receitaContratada,
    recebido,
    emAberto,
    custosTotais,
    lucroPrevisto,
    lucroRealizado: recebido,
    pagos: paymentCounts.pagos,
    parciais: paymentCounts.parciais,
    pendentes: paymentCounts.pendentes,
    comprovantesEmValidacao,
  };
}

function getMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1, 1);

  return date.toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit',
  });
}

export function buildMonthlyFinancialSeries(events = [], monthsBack = 6) {
  const now = new Date();
  const buckets = [];

  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = getMonthKey(d);

    buckets.push({
      key,
      label: getMonthLabel(key),
      receitaContratada: 0,
      custosTotais: 0,
      lucroPrevisto: 0,
    });
  }

  const byKey = new Map(buckets.map((item) => [item.key, item]));

  for (const ev of events) {
    if (!ev?.event_date) continue;

    const date = new Date(`${ev.event_date}T00:00:00`);
    if (Number.isNaN(date.getTime())) continue;

    const key = getMonthKey(date);
    const bucket = byKey.get(key);
    if (!bucket) continue;

    const receita = toNumber(ev?.agreed_amount);
    const custos =
      toNumber(ev?.musician_cost) +
      toNumber(ev?.sound_cost) +
      toNumber(ev?.extra_transport_cost) +
      toNumber(ev?.other_cost);

    bucket.receitaContratada += receita;
    bucket.custosTotais += custos;
    bucket.lucroPrevisto += receita - custos;
  }

  return buckets;
}
