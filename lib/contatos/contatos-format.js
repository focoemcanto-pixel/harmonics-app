// lib/contatos/contatos-format.js
'use client';

/**
 * Remove todos os caracteres não numéricos de um telefone
 */
export function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Formata telefone no padrão brasileiro (XX) XXXXX-XXXX
 */
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

/**
 * Formata data no padrão brasileiro DD/MM/YYYY
 */
export function formatDateBR(value) {
  if (!value) return '-';

  const s = String(value);

  // Formato ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  // Tentar parsear como Date
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return s;

  return new Intl.DateTimeFormat('pt-BR').format(date);
}

/**
 * Normaliza tag removendo espaços extras e lowercase
 */
export function normalizeTag(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/**
 * Gera iniciais do nome para avatar
 */
export function getInitials(name) {
  if (!name) return '?';
  
  const parts = String(name).trim().split(' ').filter(Boolean);
  
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
