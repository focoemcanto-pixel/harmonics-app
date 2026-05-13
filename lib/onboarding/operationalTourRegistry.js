export const OPERATIONAL_ONBOARDING_TOUR = [
  {
    key: 'dashboard-overview',
    selector: '[data-onboarding-tour="dashboard-banner"]',
    title: 'Bem-vindo ao seu workspace',
    description:
      'Aqui você acompanha o progresso da configuração e os próximos passos recomendados para deixar o Harmonics pronto para operação.',
    placement: 'bottom',
  },
  {
    key: 'onboarding-checklist',
    selector: '[data-onboarding-tour="onboarding-link"]',
    title: 'Continue pelo checklist guiado',
    description:
      'O checklist mostra exatamente o que falta configurar: templates, tipos de evento, automações, equipe e contratos.',
    placement: 'top',
  },
  {
    key: 'mobile-navigation',
    selector: '[data-onboarding-tour="mobile-more"]',
    title: 'Acesse todos os módulos',
    description:
      'No celular, o botão Mais reúne os módulos administrativos e operacionais do workspace.',
    placement: 'top',
  },
  {
    key: 'first-event',
    selector: '[data-onboarding-tour="create-first-event"]',
    title: 'Crie seu primeiro evento',
    description:
      'O fluxo principal do Harmonics começa pela criação de eventos e pré-contratos.',
    placement: 'bottom',
  },
  {
    key: 'first-precontract',
    selector: '[data-onboarding-tour="create-first-precontract"]',
    title: 'Gere um pré-contrato',
    description:
      'Aqui você cria o fluxo comercial inicial e envia o link para o cliente preencher e assinar.',
    placement: 'bottom',
  },
  {
    key: 'contract-template',
    selector: '[data-onboarding-tour="contract-template"]',
    title: 'Configure templates de contrato',
    description:
      'Os templates automatizam contratos e permitem transformar dados do evento em PDFs profissionais.',
    placement: 'bottom',
  },
];
