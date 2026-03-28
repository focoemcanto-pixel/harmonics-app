/**
 * Helpers para sistema de convites de escala
 */

/**
 * Gera URL completa do convite baseado no token
 * @param {string} token - UUID do invite_token
 * @returns {string} URL pública do convite
 */
export function generateInviteLink(token) {
  if (!token) return '';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/membro/${token}`;
}

/**
 * Verifica se um convite pode ser reenviado
 * (deve ter passado mais de 24h desde o último envio)
 * @param {object} escala - Objeto da escala com invite_sent_at
 * @returns {boolean} true se pode reenviar
 */
export function canResendInvite(escala) {
  if (!escala?.invite_sent_at) return true; // Nunca enviou

  const sentAt = new Date(escala.invite_sent_at);
  const now = new Date();
  const hoursSince = (now - sentAt) / (1000 * 60 * 60);

  return hoursSince >= 24;
}

/**
 * Formata data de envio do convite
 * @param {string} isoDate - Data ISO do invite_sent_at
 * @returns {string} Formato "DD/MM/YYYY às HH:mm"
 */
export function formatInviteSentDate(isoDate) {
  if (!isoDate) return '';

  const date = new Date(isoDate);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} às ${hours}:${minutes}`;
}
