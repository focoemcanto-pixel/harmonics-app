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

/**
 * Retorna status de saúde da base de contatos
 * @param {{ total: number, ativos: number, completos: number }} resumo
 * @returns {{ label: string, tone: string, helper: string }}
 */
export function getHealthStatus(resumo) {
  const { total, ativos, completos } = resumo;
  const inativos = total - ativos;
  const incompletos = total - completos;

  if (total === 0) {
    return {
      label: 'Nenhum contato cadastrado',
      tone: 'slate',
      helper: 'Adicione contatos para começar a organizar sua base.',
    };
  }

  if (inativos > 0) {
    return {
      label: `${inativos} contato(s) inativo(s)`,
      tone: 'amber',
      helper: 'Revise os contatos inativos para manter a base atualizada.',
    };
  }

  if (incompletos > 0) {
    return {
      label: `${incompletos} contato(s) com dados incompletos`,
      tone: 'amber',
      helper: 'Complete os dados dos contatos para melhor gestão.',
    };
  }

  return {
    label: 'Base de contatos saudável',
    tone: 'emerald',
    helper: 'Todos os contatos estão ativos e com dados completos.',
  };
}
