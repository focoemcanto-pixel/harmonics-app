// lib/contatos/contatos-ui.js
'use client';

/**
 * Retorna classes CSS para tone de tag
 */
export function getTagToneClasses(tag) {
  const normalized = String(tag || '').toLowerCase().trim();

  switch (normalized) {
    case 'cliente':
      return 'bg-violet-100 text-violet-700';
    
    case 'noivo':
    case 'noiva':
      return 'bg-pink-100 text-pink-700';
    
    case 'músico':
    case 'musico':
      return 'bg-blue-100 text-blue-700';
    
    case 'vocal':
      return 'bg-purple-100 text-purple-700';
    
    case 'fornecedor':
      return 'bg-amber-100 text-amber-700';
    
    case 'parceiro':
      return 'bg-emerald-100 text-emerald-700';
    
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

/**
 * Retorna label amigável de status
 */
export function getStatusLabel(isActive) {
  return isActive ? 'Ativo' : 'Inativo';
}

/**
 * Retorna tone visual de status
 */
export function getStatusTone(isActive) {
  return isActive ? 'emerald' : 'slate';
}

/**
 * Retorna classes para pill de status
 */
export function getStatusPillClasses(isActive) {
  return isActive
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-slate-100 text-slate-500';
}

/**
 * Verifica se contato tem informações completas
 */
export function isContactComplete(contato) {
  return !!(
    contato.name &&
    contato.email &&
    contato.phone
  );
}

/**
 * Retorna score de completude do contato (0-100)
 */
export function getCompletenessScore(contato) {
  let score = 0;
  const fields = ['name', 'email', 'phone', 'tag', 'notes'];
  
  fields.forEach((field) => {
    if (contato[field]) {
      score += 20;
    }
  });
  
  return score;
}

/**
 * Retorna label de completude
 */
export function getCompletenessLabel(score) {
  if (score === 100) return 'Completo';
  if (score >= 60) return 'Parcial';
  return 'Incompleto';
}

/**
 * Retorna tone de completude
 */
export function getCompletenessTone(score) {
  if (score === 100) return 'emerald';
  if (score >= 60) return 'amber';
  return 'slate';
}
