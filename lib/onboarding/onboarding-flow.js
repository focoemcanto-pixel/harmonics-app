// Onboarding único (2026-10): passo essencial curto + checklist contextual derivado de fatos
// reais do workspace (nada de dados fictícios). Fonte de verdade: workspace_onboarding_progress.
export const ONBOARDING_FLOW_STEPS = [
  { key: 'essentials', title: 'Dados do seu negócio', description: 'Nome, responsável, telefone, cidade e tipo de atuação.', href: '/onboarding', flag: 'essentialsCompleted' },
  { key: 'event_type', title: 'Configurar tipos de evento', description: 'Casamento, corporativo, aniversário… com valores e duração padrão.', href: '/eventos/tipos', flag: 'hasEventType' },
  { key: 'contract_template', title: 'Revisar o modelo de contrato', description: 'O texto usado nos contratos enviados para assinatura.', href: '/contratos/templates', flag: 'hasContractTemplate' },
  { key: 'musician', title: 'Cadastrar músicos', description: 'Sua equipe para montar escalas e enviar convites.', href: '/contatos', flag: 'hasMusician' },
  { key: 'first_event', title: 'Criar o primeiro evento', description: 'Data, local, formação e valores do primeiro show.', href: '/eventos/novo', flag: 'hasEvent' },
  { key: 'precontract', title: 'Enviar um pré-contrato', description: 'Link para o cliente revisar e assinar online.', href: '/pre-contratos', flag: 'hasPrecontract' },
  { key: 'complete', title: 'Tudo pronto', href: '/dashboard', flag: 'isComplete' },
];

export const ONBOARDING_GUIDE_TO_STEP = {
  template: 'contract_template',
  'event-types': 'event_type',
  precontract: 'precontract',
  'fake-members': 'fake_members',
  'formation-template': 'formation_template',
  scale: 'scale_with_formation',
  'scale-builder': 'scale_with_formation',
  'scale-with-formation': 'scale_with_formation',
  'member-panel': 'member_panel',
  'member-panel-demo': 'member_panel',
  automations: 'automation_overview',
  'automation-overview': 'automation_overview',
  finance: 'finance',
  'admin-repertoire': 'admin_repertoire',
  'dashboard-demo': 'dashboard_demo',
  'cleanup-fake-event': 'cleanup',
};

export function normalizeOnboardingGuide(value) {
  return String(value || '').trim().toLowerCase();
}

export function appendDemoEventId(href, demoEventId) {
  if (!href || !demoEventId) return href;
  const [path, query = ''] = href.split('?');
  const params = new URLSearchParams(query);
  if (!params.has('eventId')) params.set('eventId', demoEventId);
  if (path === '/eventos' && (params.get('guide') === 'scale' || params.get('guide') === 'scale-with-formation')) return `/eventos/${demoEventId}?${params.toString()}`;
  if (path === '/eventos' && params.get('guide') === 'cleanup-fake-event') return `/eventos/${demoEventId}?${params.toString()}`;
  return `${path}?${params.toString()}`;
}

export function buildOnboardingFlowStatus(facts = {}) {
  const enrichedFacts = {
    ...facts,
    isComplete: Boolean(facts.isComplete),
  };
  const current = ONBOARDING_FLOW_STEPS.find((step) => step.flag && !enrichedFacts[step.flag]) || ONBOARDING_FLOW_STEPS[ONBOARDING_FLOW_STEPS.length - 1];
  const index = ONBOARDING_FLOW_STEPS.findIndex((step) => step.key === current.key);
  const next = ONBOARDING_FLOW_STEPS[index + 1] || null;
  const nextHref = appendDemoEventId(current.href, facts.demoEventId);

  return {
    currentStep: current.key,
    nextStep: current.key,
    nextHref,
    upcomingStep: next?.key || null,
    completed: current.key === 'complete',
  };
}

export function getOnboardingStepIndex(stepKey) {
  return ONBOARDING_FLOW_STEPS.findIndex((step) => step.key === stepKey);
}

export function getRequiredStepsForGuide(guide) {
  const normalized = normalizeOnboardingGuide(guide);
  const stepKey = ONBOARDING_GUIDE_TO_STEP[normalized];
  const targetIndex = getOnboardingStepIndex(stepKey);
  if (!stepKey || targetIndex < 0) return [];
  return ONBOARDING_FLOW_STEPS.slice(0, targetIndex).filter((step) => step.flag);
}

export function canStartOnboardingGuide() {
  // Guias contextuais são opcionais no onboarding único: nunca bloqueiam a navegação.
  return { ok: true };
}
