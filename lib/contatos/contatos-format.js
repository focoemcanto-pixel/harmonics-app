/**
 * Formatação e limpeza de dados de contatos
 */

export function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export function formatPhone(value) {
  const cleaned = cleanPhone(value);
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return value || '-';
}

export function formatEmail(value) {
  return String(value || '').trim().toLowerCase() || '-';
}

export function normalizeTag(value) {
  const tag = String(value || '').trim().toLowerCase();
  if (!tag) return '';
  
  // Normaliza tags conhecidas
  if (tag.includes('cliente')) return 'Cliente';
  if (tag.includes('noivo') || tag.includes('noiva')) return 'Noivo(a)';
  if (tag.includes('músico') || tag.includes('musico')) return 'Músico';
  if (tag.includes('vocal')) return 'Vocal';
  if (tag.includes('fornecedor')) return 'Fornecedor';
  if (tag.includes('parceiro')) return 'Parceiro';
  
  // Capitaliza a primeira letra
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

export function getInitials(name) {
  if (!name) return '?';
  
  const parts = String(name).trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function formatDateBR(value) {
  if (!value) return '-';
  
  const s = String(value);
  
  // Se já é data ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  
  // Tenta parsear como Date
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return s;
  
  return new Intl.DateTimeFormat('pt-BR').format(date);
}
