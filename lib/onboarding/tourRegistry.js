export const ONBOARDING_STEPS = [
  {
    key: 'workspace_configured',
    title: 'Configure o workspace',
    description: 'Defina nome, identidade, dados de suporte e base inicial antes de operar.',
    href: '/settings/workspace',
    cta: 'Configurar workspace',
    stage: 'setup',
    order: 1,
  },
  {
    key: 'template_created',
    title: 'Crie o primeiro template de contrato',
    description: 'Monte o texto base do contrato, aprenda as tags dinâmicas e salve um modelo reutilizável.',
    href: '/contratos/templates',
    cta: 'Criar template',
    stage: 'contract_setup',
    order: 2,
  },
  {
    key: 'event_type_created',
    title: 'Associe templates aos tipos de evento',
    description: 'Crie tipos como casamento, aniversário ou corporativo e vincule cada um ao template correto.',
    href: '/eventos/tipos',
    cta: 'Configurar tipos',
    stage: 'contract_setup',
    order: 3,
  },
  {
    key: 'precontract_created',
    title: 'Gere o primeiro pré-contrato',
    description: 'Com template e tipo prontos, gere o link comercial para o cliente preencher, revisar e assinar.',
    href: '/pre-contratos',
    cta: 'Criar pré-contrato',
    stage: 'commercial_flow',
    order: 4,
  },
  {
    key: 'contract_signed_test',
    title: 'Simule a experiência do cliente',
    description: 'Abra o link externo, preencha dados fictícios, assine e valide PDF e painel do cliente.',
    href: '/pre-contratos',
    cta: 'Simular contrato',
    stage: 'commercial_flow',
    order: 5,
  },
  {
    key: 'first_event_created',
    title: 'Crie um evento operacional',
    description: 'Depois da base contratual, cadastre o evento para conectar operação, escala, repertório e financeiro.',
    href: '/eventos',
    cta: 'Criar evento',
    stage: 'operations',
    order: 6,
  },
  {
    key: 'automation_configured',
    title: 'Configure automações',
    description: 'Prepare canais, mensagens, lembretes e logs de envio para automatizar a operação.',
    href: '/automacoes/canais',
    cta: 'Configurar automações',
    stage: 'automation',
    order: 7,
  },
  {
    key: 'team_configured',
    title: 'Adicione sua equipe',
    description: 'Convide membros e defina funções dentro do workspace.',
    href: '/configuracoes/equipe',
    cta: 'Adicionar equipe',
    stage: 'scale',
    order: 8,
  },
];

export const TOUR_REGISTRY = {
  contract_event_flow: {
    title: 'Contrato + Evento completo',
    description: 'Fluxo guiado para configurar workspace, template, tags, tipos de evento, pré-contrato, assinatura e só então operação do evento.',
    steps: [
      { title: 'Workspace', href: '/settings/workspace', selector: '[data-tour="workspace-settings"]' },
      { title: 'Template', href: '/contratos/templates', selector: '[data-tour="contract-template-create"]' },
      { title: 'Tags dinâmicas', href: '/contratos/templates', selector: '[data-tour="contract-template-tags"]' },
      { title: 'Tipos de evento', href: '/eventos/tipos', selector: '[data-tour="event-type-create"]' },
      { title: 'Template por tipo', href: '/eventos/tipos', selector: '[data-tour="event-type-template-link"]' },
      { title: 'Pré-contrato', href: '/pre-contratos', selector: '[data-tour="precontract-form"]' },
      { title: 'Prévia', href: '/pre-contratos', selector: '[data-tour="precontract-preview"]' },
      { title: 'Link externo', href: '/pre-contratos', selector: '[data-tour="contract-public-link"]' },
      { title: 'Painel cliente', href: '/repertorios', selector: '[data-tour="client-panel-preview"]' },
      { title: 'Evento operacional', href: '/eventos', selector: '[data-tour="event-operation"]' },
    ],
  },
  external_contract_flow: {
    title: 'Evento com contrato externo',
    description: 'Fluxo guiado para cadastrar evento direto quando o contrato foi fechado fora do Harmonics.',
    steps: [
      { title: 'Preço', href: '/eventos', selector: '[data-tour="pricing-panel"]' },
      { title: 'Operação', href: '/eventos', selector: '[data-tour="event-operation"]' },
      { title: 'Salvar evento', href: '/eventos', selector: '[data-tour="event-save"]' },
    ],
  },
};

export function calculateOnboardingProgress(progress = {}) {
  const total = ONBOARDING_STEPS.length;
  const completed = ONBOARDING_STEPS.filter((step) => progress?.[step.key] === true).length;
  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}
