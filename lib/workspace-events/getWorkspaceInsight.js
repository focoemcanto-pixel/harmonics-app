import { WORKSPACE_EVENT_TYPES } from '@/lib/workspace-events/eventTypes';

function hasEvent(events, type) {
  return (events || []).some((event) => String(event?.type || '') === type);
}

export function getWorkspaceInsight(events = []) {
  const hasTemplate = hasEvent(events, WORKSPACE_EVENT_TYPES.TEMPLATE_CREATED);
  const hasEventType = hasEvent(events, WORKSPACE_EVENT_TYPES.EVENT_TYPE_CREATED);
  const hasChannel = hasEvent(events, WORKSPACE_EVENT_TYPES.AUTOMATION_CHANNEL_CONNECTED);
  const hasPrecontract = hasEvent(events, WORKSPACE_EVENT_TYPES.PRECONTRACT_CREATED);
  const hasContractSigned = hasEvent(events, WORKSPACE_EVENT_TYPES.CONTRACT_SIGNED);
  const hasEventCreated = hasEvent(events, WORKSPACE_EVENT_TYPES.EVENT_CREATED);
  const hasTeam = hasEvent(events, WORKSPACE_EVENT_TYPES.TEAM_MEMBER_INVITED);

  if (!hasTemplate) {
    return {
      key: 'create-template',
      eyebrow: 'Próximo passo recomendado',
      title: 'Configure seu primeiro template de contrato',
      description:
        'Antes de gerar contratos em escala, crie um modelo base com tags dinâmicas para cliente, data, local, valor e formação.',
      href: '/contratos/templates',
      cta: 'Criar template',
      priority: 'high',
    };
  }

  if (!hasEventType) {
    return {
      key: 'create-event-type',
      eyebrow: 'Próximo passo recomendado',
      title: 'Crie um tipo de evento para organizar seu catálogo',
      description:
        'Tipos como casamento, aniversário ou corporativo ajudam a associar modelos de contrato e acelerar novos pré-contratos.',
      href: '/eventos/tipos',
      cta: 'Criar tipo de evento',
      priority: 'high',
    };
  }

  if (!hasPrecontract) {
    return {
      key: 'create-precontract',
      eyebrow: 'Fluxo comercial',
      title: 'Gere o primeiro pré-contrato do workspace',
      description:
        'Com template e tipo de evento configurados, o próximo marco é gerar um link para o cliente preencher, revisar e assinar.',
      href: '/pre-contratos',
      cta: 'Gerar pré-contrato',
      priority: 'high',
    };
  }

  if (!hasChannel) {
    return {
      key: 'connect-channel',
      eyebrow: 'Automação',
      title: 'Conecte um canal WhatsApp para ativar comunicações',
      description:
        'Depois de iniciar o fluxo comercial, configure um canal para convites, lembretes, alertas e mensagens operacionais.',
      href: '/automacoes/canais',
      cta: 'Conectar canal',
      priority: 'medium',
    };
  }

  if (!hasEventCreated) {
    return {
      key: 'create-event',
      eyebrow: 'Operação',
      title: 'Crie ou importe o primeiro evento operacional',
      description:
        'Eventos conectam contrato, escala, financeiro, repertório e comunicação. Esse é o centro da operação no Harmonics.',
      href: '/eventos',
      cta: 'Abrir eventos',
      priority: 'medium',
    };
  }

  if (!hasContractSigned) {
    return {
      key: 'sign-contract',
      eyebrow: 'Momento de valor',
      title: 'Faça uma simulação de assinatura de contrato',
      description:
        'Assinar um contrato teste ajuda o usuário a entender PDF, painel do cliente e o fluxo completo do Harmonics.',
      href: '/pre-contratos',
      cta: 'Simular assinatura',
      priority: 'medium',
    };
  }

  if (!hasTeam) {
    return {
      key: 'invite-team',
      eyebrow: 'Escala de operação',
      title: 'Convide alguém da equipe para operar com você',
      description:
        'Separar acessos por função deixa o workspace pronto para uso comercial real sem compartilhar uma única conta.',
      href: '/configuracoes/equipe',
      cta: 'Convidar equipe',
      priority: 'low',
    };
  }

  return {
    key: 'workspace-ready',
    eyebrow: 'Workspace pronto',
    title: 'Seu workspace já passou pelos principais marcos iniciais',
    description:
      'Agora você pode acompanhar métricas, automatizar comunicações e operar eventos reais com mais segurança.',
    href: '/dashboard',
    cta: 'Ver dashboard',
    priority: 'success',
  };
}
