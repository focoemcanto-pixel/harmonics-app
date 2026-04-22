import { toNumber } from '@/lib/eventos/eventos-format';

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

export function isValidGrossEvent(event = {}) {
  const status = normalizeStatus(event?.status);
  if (!status) return true;

  return ![
    'deleted',
    'cancelled',
    'canceled',
    'arquivado',
    'archived',
    'draft',
    'rascunho',
  ].includes(status);
}

export function buildFinancialGroupingKey(event = {}) {
  return [
    String(event?.client_name || '').trim().toLowerCase(),
    String(event?.event_date || '').trim(),
    String(event?.location_name || '').trim().toLowerCase(),
    String(event?.event_type || '').trim().toLowerCase(),
  ].join('::');
}

export function getOfficialGrossAmount(event = {}) {
  return toNumber(event?.agreed_amount || event?.total_price || event?.amount || 0);
}

function isSameMonth(dateStr, referenceDate = new Date()) {
  if (!dateStr) return false;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;

  return (
    d.getMonth() === referenceDate.getMonth() &&
    d.getFullYear() === referenceDate.getFullYear()
  );
}

export function resolveGrossFromEvents(events = [], options = {}) {
  const rows = Array.isArray(events) ? events : [];
  const referenceDate = options.referenceDate || new Date();
  const restrictToMonth = options.restrictToMonth !== false;
  const grouped = new Map();

  for (const event of rows) {
    if (!isValidGrossEvent(event)) continue;
    if (restrictToMonth && !isSameMonth(event?.event_date, referenceDate)) continue;

    const key = buildFinancialGroupingKey(event);
    const amount = getOfficialGrossAmount(event);
    const existing = grouped.get(key);

    if (!existing || amount > existing.amount) {
      grouped.set(key, {
        id: event?.id || null,
        amount,
      });
    }
  }

  const values = Array.from(grouped.values());

  return {
    total: values.reduce((acc, row) => acc + row.amount, 0),
    eventIds: values.map((row) => row.id).filter(Boolean),
    groups: grouped.size,
  };
}
