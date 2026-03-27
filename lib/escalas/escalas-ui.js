/**
 * Retorna cor Tailwind por status
 * @param {string} status - pending | confirmed | declined | backup
 * @returns {string} Classe de cor Tailwind
 */
export function getStatusColor(status) {
  const colors = {
    pending: 'amber',
    confirmed: 'emerald',
    declined: 'red',
    backup: 'blue',
  };
  return colors[status] || 'slate';
}

/**
 * Retorna label traduzido por status
 * @param {string} status
 * @returns {string} Label em português
 */
export function getStatusLabel(status) {
  const labels = {
    pending: 'Aguardando',
    confirmed: 'Confirmado',
    declined: 'Recusado',
    backup: 'Backup',
  };
  return labels[status] || 'Indefinido';
}

/**
 * Retorna ícone por status
 * @param {string} status
 * @returns {string} Emoji
 */
export function getStatusIcon(status) {
  const icons = {
    pending: '⏳',
    confirmed: '✅',
    declined: '❌',
    backup: '🔄',
  };
  return icons[status] || '❓';
}

/**
 * Retorna classes CSS do badge por role
 * @param {string} role
 * @returns {string} Classes Tailwind
 */
export function getRoleBadgeClasses(role) {
  // Cores variadas para diferentes instrumentos
  const colors = {
    'Vocal principal': 'bg-violet-100 text-violet-700',
    'Vocal backup': 'bg-purple-100 text-purple-700',
    'Guitarra': 'bg-orange-100 text-orange-700',
    'Baixo': 'bg-amber-100 text-amber-700',
    'Teclado': 'bg-blue-100 text-blue-700',
    'Bateria': 'bg-red-100 text-red-700',
    'Percussão': 'bg-yellow-100 text-yellow-700',
    'Violino': 'bg-pink-100 text-pink-700',
    'Saxofone': 'bg-indigo-100 text-indigo-700',
    'Outro': 'bg-gray-100 text-gray-700',
  };
  return colors[role] || 'bg-slate-100 text-slate-700';
}

/**
 * Retorna resumo de formação de equipe
 * @param {array} escalas - Lista de escalas do evento
 * @returns {string} Texto de resumo (ex: "3 confirmados, 2 pendentes")
 */
export function getFormationSummary(escalas) {
  if (!escalas || escalas.length === 0) return 'Nenhum músico escalado';

  const confirmed = escalas.filter((e) => e.status === 'confirmed').length;
  const pending = escalas.filter((e) => e.status === 'pending').length;

  const parts = [];
  if (confirmed > 0) parts.push(`${confirmed} confirmado${confirmed > 1 ? 's' : ''}`);
  if (pending > 0) parts.push(`${pending} pendente${pending > 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(', ') : 'Sem confirmações';
}

/**
 * Valida formulário de escala antes de salvar
 * @param {object} form - { event_id, musician_id, role, status, notes }
 * @returns {object} { valid: boolean, errors: array }
 */
export function validateEscala(form) {
  const errors = [];

  if (!form.event_id) {
    errors.push('Selecione um evento');
  }

  if (!form.musician_id) {
    errors.push('Selecione um músico');
  }

  if (!form.role || !form.role.trim()) {
    errors.push('Informe a função/instrumento');
  }

  if (!['pending', 'confirmed', 'declined', 'backup'].includes(form.status)) {
    errors.push('Status inválido');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Retorna badge classes por status
 * @param {string} status
 * @returns {string} Classes Tailwind completas
 */
export function getStatusBadgeClasses(status) {
  const baseClasses = 'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold';
  const color = getStatusColor(status);

  const colorClasses = {
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  return `${baseClasses} ${colorClasses[color] || colorClasses.slate}`;
}
