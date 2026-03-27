'use client';

export function getTagTone(tag) {
  const normalized = String(tag || '').toLowerCase().trim();

  if (normalized.includes('vocal') || normalized.includes('cantor')) return 'violet';
  if (normalized.includes('noivo') || normalized.includes('noiva')) return 'emerald';
  if (normalized.includes('músico') || normalized.includes('instrumentista')) return 'blue';
  if (normalized.includes('cliente') || normalized.includes('contratante')) return 'amber';
  if (normalized.includes('fornecedor') || normalized.includes('parceiro')) return 'slate';

  return 'default';
}

export function getToneClasses(tone) {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-100 text-emerald-700';
    case 'amber':
      return 'bg-amber-100 text-amber-800';
    case 'red':
      return 'bg-red-100 text-red-700';
    case 'violet':
      return 'bg-violet-100 text-violet-700';
    case 'blue':
      return 'bg-sky-100 text-sky-700';
    case 'slate':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export function getInitialsClasses(tone) {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-600 text-white';
    case 'amber':
      return 'bg-amber-600 text-white';
    case 'violet':
      return 'bg-violet-600 text-white';
    case 'blue':
      return 'bg-sky-600 text-white';
    case 'slate':
      return 'bg-slate-600 text-white';
    default:
      return 'bg-slate-400 text-white';
  }
}

export function getTagToneClasses(tag) {
  return getToneClasses(getTagTone(tag));
}

export function getStatusLabel(isActive) {
  return isActive ? 'Ativo' : 'Inativo';
}

export function getStatusTone(isActive) {
  return isActive ? 'emerald' : 'slate';
}

export function getStatusPillClasses(isActive) {
  return isActive
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-slate-100 text-slate-500';
}

export function isContactComplete(contato) {
  return !!(contato.name && contato.email && contato.phone);
}

export function getCompletenessScore(contato) {
  let score = 0;
  const fields = ['name', 'email', 'phone', 'tag', 'notes'];
  fields.forEach((field) => {
    if (contato[field]) score += 20;
  });
  return score;
}

export function getCompletenessLabel(score) {
  if (score === 100) return 'Completo';
  if (score >= 60) return 'Parcial';
  return 'Incompleto';
}

export function getCompletenessTone(score) {
  if (score === 100) return 'emerald';
  if (score >= 60) return 'amber';
  return 'slate';
}

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
