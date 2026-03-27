'use client';

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
  const s = String(value);

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return s;

  return new Intl.DateTimeFormat('pt-BR').format(date);
}

export function normalizeTag(value) {
  return String(value || '').trim().toLowerCase();
}

export function formatInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function getWhatsAppLink(phone, message = '') {
  const cleaned = cleanPhone(phone);
  if (!cleaned) return null;
  const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
  const encodedMsg = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${number}${encodedMsg}`;
}

export function formatPhone(value) {
  return formatPhoneDisplay(value);
}

export function getInitials(name) {
  return formatInitials(name);
}
