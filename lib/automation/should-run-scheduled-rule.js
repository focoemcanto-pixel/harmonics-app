function getSaoPauloMinutesNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const value = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return value('hour') * 60 + value('minute');
}

function parseSendTime(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function shouldRunScheduledRule(eventType, rule) {
  if (eventType === 'event_day_confirmation_client') return true;
  if (eventType === 'post_event_review_request_client' && rule?.delay_hours != null) return true;

  const sendAt = parseSendTime(rule?.send_time);
  if (sendAt == null) return true;

  const now = getSaoPauloMinutesNow();
  // Permite recuperação de atraso até 18:30. A deduplicação do motor impede
  // repetição nas execuções horárias seguintes do mesmo dia.
  return now >= sendAt && now <= 18 * 60 + 30;
}
