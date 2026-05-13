export const ONBOARDING_STEPS = [
  {
    key: 'workspace_configured',
    title: 'Configure o workspace',
    description: 'Nome, cor principal, WhatsApp de suporte e identidade inicial.',
    href: '/settings/workspace',
    cta: 'Configurar workspace',
  },
  {
    key: 'template_created',
    title: 'Crie o primeiro modelo',
    description: 'Prepare o texto base que será usado para documentos do cliente.',
    href: '/contratos/templates',
    cta: 'Criar modelo',
  },
  {
    key: 'event_type_created',
    title: 'Configure tipos de evento',
    description: 'Cadastre categorias e relacione cada uma ao modelo correto.',
    href: '/eventos/tipos',
    cta: 'Configurar tipos',
  },
  {
    key: 'precontract_created',
    title: 'Gere o primeiro pré-contrato',
    description: 'Preencha dados comerciais, evento, valores e revise a prévia.',
    href: '/pre-contratos',
    cta: 'Criar pré-contrato',
  },
  {
    key: 'contract_signed_test',
    title: 'Simule a experiência do cliente',
    description: 'Abra o link externo, revise o fluxo e valide o documento final.',
    href: '/pre-contratos',
    cta: 'Simular contrato',
  },
  {
    key: 'first_event_created',
    title: 'Crie um evento operacional',
    description: 'Monte a operação do evento, escala, repertório e financeiro.',
    href: '/eventos',
    cta: 'Criar evento',
  },
  {
    key: 'automation_configured',
    title: 'Configure automações',
    description: 'Prepare canais, mensagens, lembretes e logs de envio.',
    href: '/settings/integrations',
    cta: 'Configurar automações',
  },
  {
    key: 'team_configured',
    title: 'Adicione sua equipe',
    description: 'Convide membros e defina funções dentro do workspace.',
    href: '/configuracoes/equipe',
    cta: 'Adicionar equipe',
  },
];

export const TOUR_REGISTRY = {
  contract_event_flow: {
    title: 'Contrato + Evento completo',
    description: 'Fluxo guiado para configurar modelo, tipo, pré-contrato e experiência do cliente.',
    steps: [
      { title: 'Modelo', href: '/contratos/templates', selector: '[data-tour="contract-template-create"]' },
      { title: 'Tipos', href: '/eventos/tipos', selector: '[data-tour="event-type-create"]' },
      { title: 'Pré-contrato', href: '/pre-contratos', selector: '[data-tour="precontract-form"]' },
      { title: 'Prévia', href: '/pre-contratos', selector: '[data-tour="precontract-preview"]' },
      { title: 'Link externo', href: '/pre-contratos', selector: '[data-tour="contract-public-link"]' },
      { title: 'Painel cliente', href: '/repertorios', selector: '[data-tour="client-panel-preview"]' },
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
