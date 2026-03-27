/**
 * Helpers visuais e de UI para contatos
 */

export function getTagTone(tag) {
  const t = String(tag || '').toLowerCase();
  
  if (t.includes('cliente')) return 'violet';
  if (t.includes('noivo') || t.includes('noiva')) return 'emerald';
  if (t.includes('músico') || t.includes('musico')) return 'blue';
  if (t.includes('vocal')) return 'amber';
  if (t.includes('fornecedor')) return 'slate';
  if (t.includes('parceiro')) return 'indigo';
  
  return 'default';
}

export function getToneClasses(tone) {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-100 text-emerald-700';
    case 'violet':
      return 'bg-violet-100 text-violet-700';
    case 'blue':
      return 'bg-sky-100 text-sky-700';
    case 'amber':
      return 'bg-amber-100 text-amber-800';
    case 'slate':
      return 'bg-slate-100 text-slate-700';
    case 'indigo':
      return 'bg-indigo-100 text-indigo-700';
    case 'red':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export function getStatusBadge(isActive) {
  return isActive !== false
    ? { label: 'Ativo', tone: 'emerald' }
    : { label: 'Inativo', tone: 'slate' };
}

export function getWhatsAppLink(phone) {
  if (!phone) return null;
  
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length < 10) return null;
  
  return `https://wa.me/55${cleaned}`;
}

export function getEmailLink(email) {
  if (!email) return null;
  
  const cleaned = String(email).trim();
  if (!cleaned.includes('@')) return null;
  
  return `mailto:${cleaned}`;
}

export function hasContactInfo(contato) {
  return !!(contato.email || contato.phone);
}

export function getContactCompleteness(contato) {
  let score = 0;
  const total = 5;
  
  if (contato.name) score++;
  if (contato.email) score++;
  if (contato.phone) score++;
  if (contato.tag) score++;
  if (contato.notes) score++;
  
  return {
    score,
    total,
    percentage: Math.round((score / total) * 100),
    isComplete: score === total,
  };
}
