import { WORKSPACE_EVENT_TYPES } from '@/lib/workspace-events/eventTypes';

function hasEvent(events = [], type) {
  return events.some((event) => String(event?.type || '') === type);
}

function countEvent(events = [], type) {
  return events.filter((event) => String(event?.type || '') === type).length;
}

export function getWorkspaceRecommendations(events = [], health = null) {
  const recommendations = [];

  const hasTemplate = hasEvent(events, WORKSPACE_EVENT_TYPES.TEMPLATE_CREATED);
  const hasEventType = hasEvent(events, WORKSPACE_EVENT_TYPES.EVENT_TYPE_CREATED);
  const hasPrecontract = hasEvent(events, WORKSPACE_EVENT_TYPES.PRECONTRACT_CREATED);
  const hasChannel = hasEvent(events, WORKSPACE_EVENT_TYPES.AUTOMATION_CHANNEL_CONNECTED);
  const hasEventCreated = hasEvent(events, WORKSPACE_EVENT_TYPES.EVENT_CREATED);
  const hasContractSigned = hasEvent(events, WORKSPACE_EVENT_TYPES.CONTRACT_SIGNED);
  const hasTeam = hasEvent(events, WORKSPACE_EVENT_TYPES.TEAM_MEMBER_INVITED);

  if (!hasTemplate) {
    recommendations.push({
      id: 'missing-template',
      priority: 'critical',
      type: 'setup_blocker',
      title: 'Configure um template de contrato',
      description: 'Sem um template o workspace não consegue operar o fluxo completo de contratos.',
      actionLabel: 'Criar template',
      href: '/contratos/templates',
    });
  }

  if (hasTemplate && !hasEventType) {
    recommendations.push({
      id: 'missing-event-type',
      priority: 'high',
      type: 'commercial_structure',
      title: 'Crie tipos de evento para organizar o catálogo',
      description: 'Tipos de evento aceleram contratos e padronizam operações comerciais.',
      actionLabel: 'Criar tipo',
      href: '/eventos/tipos',
    });
  }

  if (hasTemplate && hasEventType && !hasPrecontract) {
    recommendations.push({
      id: 'missing-precontract',
      priority: 'high',
      type: 'commercial_flow',
      title: 'Teste o fluxo comercial com um pré-contrato',
      description: 'Gere um link de pré-contrato para validar assinatura, PDF e painel do cliente.',
      actionLabel: 'Gerar pré-contrato',
      href: '/pre-contratos',
    });
  }

  if (hasPrecontract && !hasChannel) {
    recommendations.push({
      id: 'missing-automation',
      priority: 'medium',
      type: 'automation',
      title: 'Conecte um canal WhatsApp',
      description: 'Ative automações de convites, lembretes e alertas operacionais.',
      actionLabel: 'Conectar canal',
      href: '/automacoes/canais',
    });
  }

  if (hasContractSigned && !hasEventCreated) {
    recommendations.push({
      id: 'missing-operational-event',
      priority: 'medium',
      type: 'operations',
      title: 'Transforme contratos em eventos operacionais',
      description: 'Eventos conectam escalas, financeiro, repertório e comunicação.',
      actionLabel: 'Abrir eventos',
      href: '/eventos',
    });
  }

  if (hasEventCreated && !hasTeam) {
    recommendations.push({
      id: 'missing-team',
      priority: 'low',
      type: 'collaboration',
      title: 'Convide sua equipe para operar junto',
      description: 'Separar acessos por função melhora organização e escala operacional.',
      actionLabel: 'Convidar equipe',
      href: '/configuracoes/equipe',
    });
  }

  const contractsSigned = countEvent(events, WORKSPACE_EVENT_TYPES.CONTRACT_SIGNED);
  const precontractsCreated = countEvent(events, WORKSPACE_EVENT_TYPES.PRECONTRACT_CREATED);

  if (precontractsCreated >= 3 && contractsSigned === 0) {
    recommendations.push({
      id: 'low-conversion',
      priority: 'high',
      type: 'conversion',
      title: 'Seus pré-contratos ainda não converteram em assinaturas',
      description: 'Revise abordagem comercial, mensagens e clareza do fluxo enviado ao cliente.',
      actionLabel: 'Revisar contratos',
      href: '/pre-contratos',
    });
  }

  if ((health?.score || 0) >= 85) {
    recommendations.push({
      id: 'healthy-workspace',
      priority: 'success',
      type: 'growth',
      title: 'Seu workspace está saudável',
      description: 'Agora vale focar em automações avançadas e crescimento operacional.',
      actionLabel: 'Ver automações',
      href: '/automacoes',
    });
  }

  return recommendations;
}
