function formatDateBR(value) {
  if (!value) return '-';
  const [y, m, d] = String(value).split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function formatTime(value) {
  return value ? String(value).slice(0, 5) : '--:--';
}

export function buildInviteMessage({ contactName, event, inviteLink, role }) {
  const saudacao = contactName ? `Olá, ${contactName}!` : 'Olá!';
  const cliente = event?.client_name || 'Evento';
  const data = formatDateBR(event?.event_date);
  const hora = formatTime(event?.event_time);
  const local = event?.location_name || 'Local a confirmar';
  const funcao = role || 'função a confirmar';

  return `${saudacao}

Você foi pré-escalado para um evento da Harmonics.

*Evento:* ${cliente}
*Data:* ${data}
*Hora:* ${hora}
*Local:* ${local}
*Função sugerida:* ${funcao}

Você tem disponibilidade para este evento?

Acesse seu painel para confirmar ou recusar:
${inviteLink}`;
}
