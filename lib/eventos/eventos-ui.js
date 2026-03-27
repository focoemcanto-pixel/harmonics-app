export function isPastEvent(eventDate) {
  if (!eventDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const event = new Date(`${eventDate}T00:00:00`);
  event.setHours(0, 0, 0, 0);

  return event.getTime() < today.getTime();
}

export function isTodayEvent(eventDate) {
  if (!eventDate) return false;

  const today = new Date();
  const event = new Date(`${eventDate}T00:00:00`);

  return (
    today.getFullYear() === event.getFullYear() &&
    today.getMonth() === event.getMonth() &&
    today.getDate() === event.getDate()
  );
}

export function isUpcomingEvent(eventDate, days = 7) {
  if (!eventDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const limit = new Date();
  limit.setHours(0, 0, 0, 0);
  limit.setDate(limit.getDate() + days);

  const event = new Date(`${eventDate}T00:00:00`);
  event.setHours(0, 0, 0, 0);

  return (
    event.getTime() >= today.getTime() &&
    event.getTime() <= limit.getTime()
  );
}

export function getTimelineLabel(eventDate) {
  if (!eventDate) return { text: 'Sem data', tone: 'default' };
  if (isTodayEvent(eventDate)) return { text: 'Hoje', tone: 'blue' };
  if (isPastEvent(eventDate)) return { text: 'Realizado', tone: 'default' };
  return { text: 'Próximo', tone: 'emerald' };
}

export function getOperationalTone(status) {
  const value = String(status || '').trim().toLowerCase();

  if (value === 'executado' || value === 'done') return 'blue';
  if (value === 'confirmado' || value === 'confirmed') return 'emerald';
  if (value === 'rascunho' || value === 'draft') return 'amber';
  if (value === 'cancelado' || value === 'cancelled') return 'red';

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
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export function getPriorityBannerClasses(tone) {
  switch (tone) {
    case 'amber':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'violet':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'blue':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'emerald':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}