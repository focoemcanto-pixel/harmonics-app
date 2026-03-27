'use client';

export function formatDateBR(value) {
  if (!value) return '-';

  const s = String(value);

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return s;

  return new Intl.DateTimeFormat('pt-BR').format(date);
}
