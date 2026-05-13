import { WORKSPACE_EVENT_TYPES } from '@/lib/workspace-events/eventTypes';

const EVENT_PRESENTATION = Object.freeze({
  [WORKSPACE_EVENT_TYPES.WORKSPACE_CONFIGURED]: {
    icon: '🏢',
    title: 'Workspace configurado',
    description: 'As configurações principais do workspace foram ajustadas.',
    tone: 'violet',
  },
  [WORKSPACE_EVENT_TYPES.TEMPLATE_CREATED]: {
    icon: '📄',
    title: 'Template de contrato criado',
    description: 'Um modelo de contrato foi configurado para automatizar o fluxo comercial.',
    tone: 'violet',
  },
  [WORKSPACE_EVENT_TYPES.EVENT_TYPE_CREATED]: {
    icon: '🏷️',
    title: 'Tipo de evento criado',
    description: 'O catálogo comercial ganhou um novo tipo de evento.',
    tone: 'blue',
  },
  [WORKSPACE_EVENT_TYPES.PRECONTRACT_CREATED]: {
    icon: '🔗',
    title: 'Pré-contrato gerado',
    description: 'Um link comercial foi criado para o cliente preencher e avançar para assinatura.',
    tone: 'amber',
  },
  [WORKSPACE_EVENT_TYPES.CONTRACT_SIGNED]: {
    icon: '✅',
    title: 'Contrato assinado',
    description: 'O cliente concluiu a assinatura do contrato.',
    tone: 'emerald',
  },
  [WORKSPACE_EVENT_TYPES.EVENT_CREATED]: {
    icon: '📅',
    title: 'Evento criado',
    description: 'Um evento foi adicionado à operação do workspace.',
    tone: 'blue',
  },
  [WORKSPACE_EVENT_TYPES.AUTOMATION_CHANNEL_CONNECTED]: {
    icon: '📲',
    title: 'Canal WhatsApp conectado',
    description: 'Um canal de comunicação foi configurado para automações e mensagens operacionais.',
    tone: 'emerald',
  },
  [WORKSPACE_EVENT_TYPES.TEAM_MEMBER_INVITED]: {
    icon: '👥',
    title: 'Membro convidado',
    description: 'Uma pessoa foi adicionada ou convidada para colaborar no workspace.',
    tone: 'slate',
  },
});

function formatRelativeDate(value) {
  if (!value) return 'Agora';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Agora';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Agora';
  if (diffMinutes < 60) return `${diffMinutes} min atrás`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h atrás`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} dia${diffDays > 1 ? 's' : ''} atrás`;

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function presentWorkspaceEvent(event) {
  const type = String(event?.type || '').trim();
  const base = EVENT_PRESENTATION[type] || {
    icon: '✨',
    title: 'Atividade registrada',
    description: 'Uma nova atividade foi registrada no workspace.',
    tone: 'slate',
  };

  return {
    id: event?.id || null,
    type,
    icon: base.icon,
    title: base.title,
    description: base.description,
    tone: base.tone,
    metadata: event?.metadata || {},
    createdAt: event?.created_at || null,
    relativeTime: formatRelativeDate(event?.created_at),
  };
}
