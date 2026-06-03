export function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const cleaned = String(value)
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(toNumber(value));
}

export function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export function formatPhoneDisplay(value) {
  const cleaned = cleanPhone(value);
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return value || '-';
}

export function formatDateBR(value) {
  if (!value) return '-';
  const [datePart] = String(value).split('T');
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export function getMonthKey(dateValue) {
  if (!dateValue) return '';
  const [datePart] = String(dateValue).split('T');
  const [year, month] = datePart.split('-');
  if (!year || !month) return '';
  return `${year}-${month}`;
}

export function formatMonthYearLabel(monthKey) {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);

  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
    .format(date)
    .replace(/^./, (c) => c.toUpperCase());
}
