/**
 * Formata o label de uma função/instrumento
 * @param {string} role - "Vocal principal", "Guitarra", etc.
 * @returns {string} Label formatado
 */
export function formatRoleLabel(role) {
  if (!role) return 'Sem função';
  return role.trim();
}

/**
 * Retorna ícone emoji por função/instrumento
 * @param {string} role
 * @returns {string} Emoji
 */
export function getRoleIcon(role) {
  const icons = {
    'Vocal principal': '🎤',
    'Vocal backup': '🎵',
    'Guitarra': '🎸',
    'Baixo': '🎸',
    'Teclado': '🎹',
    'Bateria': '🥁',
    'Percussão': '🪘',
    'Violino': '🎻',
    'Saxofone': '🎷',
    'Outro': '🎼',
  };
  return icons[role] || '🎼';
}

/**
 * Formata nome do músico a partir do objeto contact
 * @param {object} contact - Objeto contact { name, tag }
 * @returns {string} Nome formatado
 */
export function formatMusicianName(contact) {
  if (!contact) return 'Músico não identificado';
  const name = contact.name || 'Sem nome';
  const tag = contact.tag ? ` (${contact.tag})` : '';
  return `${name}${tag}`;
}

/**
 * Retorna iniciais do nome do músico para avatar
 * @param {object} contact - Objeto contact { name }
 * @returns {string} Iniciais (ex: "JS")
 */
export function getMusicianInitials(contact) {
  if (!contact || !contact.name) return '??';
  const parts = contact.name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Formata nome do evento a partir do objeto event
 * @param {object} event - Objeto event { client_name, event_date }
 * @returns {string} Nome formatado
 */
export function formatEventName(event) {
  if (!event) return 'Evento não identificado';
  const client = event.client_name || 'Cliente';
  const date = event.event_date ? ` - ${formatDateBR(event.event_date)}` : '';
  return `${client}${date}`;
}

/**
 * Formata data no padrão brasileiro
 * @param {string} dateStr - Data no formato ISO (YYYY-MM-DD)
 * @returns {string} Data formatada (DD/MM/YYYY)
 */
export function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).split('T')[0].split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

/**
 * Formata timestamp de confirmação
 * @param {string} confirmedAt - Timestamp ISO
 * @returns {string} Data formatada ou vazio
 */
export function formatConfirmedAt(confirmedAt) {
  if (!confirmedAt) return '';
  return `Confirmado em ${formatDateBR(String(confirmedAt).split('T')[0])}`;
}
