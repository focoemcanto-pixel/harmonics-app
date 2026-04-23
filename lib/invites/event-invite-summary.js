export const EVENT_FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'acao', label: 'Precisam de ação' },
  { key: 'proximos7', label: 'Próximos 7 dias' },
  { key: 'pendentes', label: 'Com pendentes' },
  { key: 'recusas', label: 'Com recusas' },
  { key: 'fechados', label: 'Escala fechada' },
];

export function normalizeInviteStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();

  if (normalized === 'confirmed' || normalized === 'confirmado') return 'confirmado';
  if (normalized === 'declined' || normalized === 'recusado') return 'recusado';

  return 'pendente';
}

export function getInviteStatusLabel(statusKey) {
  if (statusKey === 'confirmado') return 'Confirmado';
  if (statusKey === 'recusado') return 'Recusado';
  return 'Pendente';
}

export function getDaysUntilEvent(dateStr) {
  if (!dateStr) return Number.POSITIVE_INFINITY;

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.ceil((target - start) / (1000 * 60 * 60 * 24));
}

export function isWithinDays(dateStr, days = 7) {
  const diff = getDaysUntilEvent(dateStr);
  return diff >= 0 && diff <= days;
}

function getPriorityBucket(group) {
  const proximidade = getDaysUntilEvent(group.event?.event_date);

  if (group.pendentes > 0 && proximidade >= 0) return 1;
  if (group.coberturaFaltando) return 2;
  if (group.recusados > 0) return 3;
  if (group.pendentes > 0) return 4;
  return 5;
}

function getEventStatusSummary(group) {
  const { total, confirmados, pendentes, recusados, coberturaFaltando, event } = group;
  const proximidade = getDaysUntilEvent(event?.event_date);

  if (total === 0 || (coberturaFaltando && proximidade <= 7 && proximidade >= 0 && (pendentes > 0 || recusados > 0))) {
    return { label: 'Evento em risco', tone: 'red' };
  }

  if (coberturaFaltando && recusados > 0) {
    return { label: 'Recusa recebida', tone: 'red' };
  }

  if (coberturaFaltando && pendentes > 0) {
    return { label: 'Aguardando respostas', tone: 'amber' };
  }

  if (coberturaFaltando) {
    return { label: 'Cobertura incompleta', tone: 'violet' };
  }

  if (confirmados > 0 && confirmados === total) {
    return { label: 'Escala fechada', tone: 'emerald' };
  }

  return { label: 'Aguardando respostas', tone: 'amber' };
}

export function buildEventInviteGroups({ invites = [], events = [], contacts = [] }) {
  const eventMap = new Map(events.map((event) => [String(event.id), event]));
  const contactMap = new Map(contacts.map((contact) => [String(contact.id), contact]));

  const enrichedInvites = invites
    .map((invite) => {
      const event = eventMap.get(String(invite.event_id));
      if (!event) return null;

      const statusKey = normalizeInviteStatus(invite.status);
      const contact = contactMap.get(String(invite.musician_id));

      return {
        ...invite,
        event,
        contact,
        statusKey,
        statusLabel: getInviteStatusLabel(statusKey),
      };
    })
    .filter(Boolean);

  const groupedMap = new Map();

  enrichedInvites.forEach((invite) => {
    const key = String(invite.event_id);
    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        eventId: key,
        event: invite.event,
        invites: [],
        total: 0,
        confirmados: 0,
        pendentes: 0,
        recusados: 0,
      });
    }

    const current = groupedMap.get(key);
    current.invites.push(invite);
    current.total += 1;
    if (invite.statusKey === 'confirmado') current.confirmados += 1;
    if (invite.statusKey === 'pendente') current.pendentes += 1;
    if (invite.statusKey === 'recusado') current.recusados += 1;
  });

  const groupedEvents = Array.from(groupedMap.values())
    .map((group) => {
      const coberturaFaltando = group.confirmados < group.total;
      const statusGeral = getEventStatusSummary({ ...group, coberturaFaltando });

      return {
        ...group,
        coberturaFaltando,
        statusGeral,
        prioridade: getPriorityBucket({ ...group, coberturaFaltando }),
        emRisco: statusGeral.label === 'Evento em risco',
      };
    })
    .sort((a, b) => {
      if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;

      const diffA = getDaysUntilEvent(a.event?.event_date);
      const diffB = getDaysUntilEvent(b.event?.event_date);
      if (diffA !== diffB) return diffA - diffB;

      return String(a.event?.client_name || '').localeCompare(String(b.event?.client_name || ''));
    });

  return { enrichedInvites, groupedEvents };
}
