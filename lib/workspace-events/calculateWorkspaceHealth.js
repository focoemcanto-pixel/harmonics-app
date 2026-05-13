import { WORKSPACE_EVENT_TYPES } from '@/lib/workspace-events/eventTypes';

function countByType(events = [], type) {
  return events.filter((event) => String(event?.type || '') === type).length;
}

function hasEvent(events = [], type) {
  return countByType(events, type) > 0;
}

function clampScore(value) {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

export function calculateWorkspaceHealth(events = []) {
  const checks = [
    {
      key: 'template',
      label: 'Template configurado',
      completed: hasEvent(events, WORKSPACE_EVENT_TYPES.TEMPLATE_CREATED),
      weight: 18,
    },
    {
      key: 'event_type',
      label: 'Tipo de evento criado',
      completed: hasEvent(events, WORKSPACE_EVENT_TYPES.EVENT_TYPE_CREATED),
      weight: 14,
    },
    {
      key: 'precontract',
      label: 'Pré-contrato gerado',
      completed: hasEvent(events, WORKSPACE_EVENT_TYPES.PRECONTRACT_CREATED),
      weight: 18,
    },
    {
      key: 'automation',
      label: 'Canal WhatsApp conectado',
      completed: hasEvent(events, WORKSPACE_EVENT_TYPES.AUTOMATION_CHANNEL_CONNECTED),
      weight: 14,
    },
    {
      key: 'event',
      label: 'Evento operacional criado',
      completed: hasEvent(events, WORKSPACE_EVENT_TYPES.EVENT_CREATED),
      weight: 14,
    },
    {
      key: 'contract_signed',
      label: 'Contrato assinado',
      completed: hasEvent(events, WORKSPACE_EVENT_TYPES.CONTRACT_SIGNED),
      weight: 14,
    },
    {
      key: 'team',
      label: 'Equipe convidada',
      completed: hasEvent(events, WORKSPACE_EVENT_TYPES.TEAM_MEMBER_INVITED),
      weight: 8,
    },
  ];

  const score = clampScore(
    checks.reduce((total, check) => total + (check.completed ? check.weight : 0), 0)
  );

  const completedChecks = checks.filter((check) => check.completed).length;
  const totalChecks = checks.length;

  const metrics = {
    totalEvents: events.length,
    templatesCreated: countByType(events, WORKSPACE_EVENT_TYPES.TEMPLATE_CREATED),
    eventTypesCreated: countByType(events, WORKSPACE_EVENT_TYPES.EVENT_TYPE_CREATED),
    precontractsCreated: countByType(events, WORKSPACE_EVENT_TYPES.PRECONTRACT_CREATED),
    contractsSigned: countByType(events, WORKSPACE_EVENT_TYPES.CONTRACT_SIGNED),
    operationalEventsCreated: countByType(events, WORKSPACE_EVENT_TYPES.EVENT_CREATED),
    automationChannelsConnected: countByType(events, WORKSPACE_EVENT_TYPES.AUTOMATION_CHANNEL_CONNECTED),
    teamMembersInvited: countByType(events, WORKSPACE_EVENT_TYPES.TEAM_MEMBER_INVITED),
  };

  let status = 'initial';
  let label = 'Configuração inicial';
  let description = 'O workspace ainda está nos primeiros passos de configuração.';

  if (score >= 85) {
    status = 'healthy';
    label = 'Workspace saudável';
    description = 'O workspace já concluiu os principais marcos iniciais e está pronto para operação real.';
  } else if (score >= 55) {
    status = 'progressing';
    label = 'Workspace em evolução';
    description = 'O workspace já tem boa parte da base pronta, mas ainda existem marcos importantes pendentes.';
  } else if (score >= 25) {
    status = 'setup';
    label = 'Setup em andamento';
    description = 'O workspace começou a ser configurado, mas ainda precisa concluir etapas comerciais e operacionais.';
  }

  return {
    score,
    status,
    label,
    description,
    completedChecks,
    totalChecks,
    checks,
    metrics,
  };
}
