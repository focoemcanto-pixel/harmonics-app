/**
 * Filtra escalas por evento
 * @param {array} escalas
 * @param {string} eventId
 * @returns {array} Escalas filtradas
 */
export function filterByEvent(escalas, eventId) {
  if (!eventId || eventId === 'all') return escalas;
  return escalas.filter((e) => e.event_id === eventId);
}

/**
 * Filtra escalas por músico
 * @param {array} escalas
 * @param {string} musicianId
 * @returns {array} Escalas filtradas
 */
export function filterByMusician(escalas, musicianId) {
  if (!musicianId || musicianId === 'all') return escalas;
  return escalas.filter((e) => e.musician_id === musicianId);
}

/**
 * Filtra escalas por músico, evento ou função
 * @param {array} escalas
 * @param {string} searchTerm
 * @returns {array} Escalas filtradas
 */
export function filterBySearch(escalas, searchTerm) {
  const q = String(searchTerm || '').trim().toLowerCase();
  if (!q) return escalas;
  return escalas.filter(
    (e) =>
      String(e.contacts?.name || '').toLowerCase().includes(q) ||
      String(e.events?.client_name || '').toLowerCase().includes(q) ||
      String(e.role || '').toLowerCase().includes(q)
  );
}

/**
 * Filtra escalas por status
 * @param {array} escalas
 * @param {string} status - pending | confirmed | declined | backup | all | todos
 * @returns {array} Escalas filtradas
 */
export function filterByStatus(escalas, status) {
  if (!status || status === 'all' || status === 'todos') return escalas;
  return escalas.filter((e) => e.status === status);
}

/**
 * Filtra escalas por função/instrumento
 * @param {array} escalas
 * @param {string} role
 * @returns {array} Escalas filtradas
 */
export function filterByRole(escalas, role) {
  if (!role || role === 'all') return escalas;
  return escalas.filter((e) => e.role === role);
}

/**
 * Ordena escalas por função
 * @param {array} escalas
 * @returns {array} Escalas ordenadas
 */
export function sortByRole(escalas) {
  return [...escalas].sort((a, b) => {
    const roleA = a.role || '';
    const roleB = b.role || '';
    return roleA.localeCompare(roleB);
  });
}

/**
 * Ordena escalas por status de confirmação
 * @param {array} escalas
 * @returns {array} Escalas ordenadas (confirmed primeiro)
 */
export function sortByConfirmation(escalas) {
  const order = { confirmed: 1, pending: 2, declined: 3, backup: 4 };
  return [...escalas].sort((a, b) => {
    const orderA = order[a.status] || 99;
    const orderB = order[b.status] || 99;
    return orderA - orderB;
  });
}

/**
 * Agrupa escalas por evento
 * @param {array} escalas
 * @returns {object} Map { eventId: [escalas] }
 */
export function groupByEvent(escalas) {
  const groups = {};
  escalas.forEach((escala) => {
    const key = escala.event_id || 'sem_evento';
    if (!groups[key]) groups[key] = [];
    groups[key].push(escala);
  });
  return groups;
}

/**
 * Agrupa escalas por músico
 * @param {array} escalas
 * @returns {object} Map { musicianId: [escalas] }
 */
export function groupByMusician(escalas) {
  const groups = {};
  escalas.forEach((escala) => {
    const key = escala.musician_id || 'sem_musico';
    if (!groups[key]) groups[key] = [];
    groups[key].push(escala);
  });
  return groups;
}

/**
 * Retorna lista única de funções/instrumentos
 * @param {array} escalas
 * @returns {array} Lista de roles únicas
 */
export function getUniqueRoles(escalas) {
  const roles = escalas.map((e) => e.role).filter(Boolean);
  return [...new Set(roles)].sort();
}
