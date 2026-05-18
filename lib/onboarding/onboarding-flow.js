export const ONBOARDING_FLOW_STEPS = [
  { key: 'dashboard', title: 'Boas-vindas', href: '/dashboard?onboarding=fresh-workspace' },
  { key: 'contract_template', title: 'Template de contrato', href: '/contratos/templates?guide=template', flag: 'hasContractTemplate' },
  { key: 'event_type', title: 'Tipo de evento', href: '/eventos/tipos?guide=event-types', flag: 'hasEventType' },
  { key: 'precontract', title: 'Pré-contrato fake', href: '/pre-contratos?guide=precontract', flag: 'hasPrecontract' },
  { key: 'public_contract', title: 'Contrato público', href: '/pre-contratos?guide=precontract', flag: 'hasPrecontract' },
  { key: 'sign_contract', title: 'Assinatura do cliente', href: '/pre-contratos?guide=precontract', flag: 'hasSignedContract' },
  { key: 'signed_pdf', title: 'PDF assinado', href: '/pre-contratos?guide=precontract', flag: 'hasSignedContract' },
  { key: 'client_panel', title: 'Painel do cliente', href: '/pre-contratos?guide=client-panel', flag: 'hasSignedContract' },
  { key: 'client_repertoire', title: 'Repertório do cliente', href: '/pre-contratos?guide=client-panel', flag: 'hasClientRepertoireSubmitted' },
  { key: 'admin_return', title: 'Voltar ao admin', href: '/dashboard', flag: 'hasClientRepertoireSubmitted' },
  { key: 'fake_members', title: 'Membros fake/equipe', href: '/configuracoes/equipe?guide=fake-members', flag: 'hasFakeMembers' },
  { key: 'formation_template', title: 'Template de formação', href: '/templates-escala?guide=formation-template', flag: 'hasFormationTemplate' },
  { key: 'scale', title: 'Escala do evento demo', href: '/eventos?guide=scale', flag: 'hasScale' },
  { key: 'member_panel', title: 'Painel do membro', href: '/membro?guide=member-panel', flag: 'hasMemberPanelViewed' },
  { key: 'automations', title: 'Automações', href: '/automacoes?guide=automations', flag: 'hasAutomationsViewed' },
  { key: 'finance', title: 'Financeiro', href: '/pagamentos?guide=finance', flag: 'hasFinanceViewed' },
  { key: 'admin_repertoire', title: 'Repertório no admin', href: '/repertorios?guide=admin-repertoire', flag: 'hasAdminRepertoireViewed' },
  { key: 'dashboard_demo', title: 'Dashboard com evento demo', href: '/dashboard?guide=dashboard-demo', flag: 'hasDashboardDemoViewed' },
  { key: 'cleanup', title: 'Apagar evento demo', href: '/eventos?guide=cleanup-fake-event', flag: 'canCleanupDemoEvent' },
  { key: 'complete', title: 'Onboarding concluído', href: '/settings/onboarding', flag: 'isComplete' },
];

export const ONBOARDING_GUIDE_TO_STEP = {
  template: 'contract_template',
  'event-types': 'event_type',
  precontract: 'precontract',
  'client-panel': 'client_panel',
  'fake-members': 'fake_members',
  'formation-template': 'formation_template',
  scale: 'scale',
  'scale-builder': 'scale',
  'member-panel': 'member_panel',
  automations: 'automations',
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
  if (path === '/eventos' && params.get('guide') === 'scale') return `/eventos/${demoEventId}?${params.toString()}`;
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

export function canStartOnboardingGuide(status = {}, guide) {
  const normalized = normalizeOnboardingGuide(guide);
  const stepKey = ONBOARDING_GUIDE_TO_STEP[normalized];
  if (!stepKey) return { ok: true };

  const missing = getRequiredStepsForGuide(normalized).find((step) => status?.[step.flag] !== true);
  if (missing) {
    return {
      ok: false,
      blockedBy: missing.key,
      redirectHref: status?.nextHref || appendDemoEventId(missing.href, status?.demoEventId),
    };
  }

  if (normalized === 'cleanup-fake-event' && status?.canCleanupDemoEvent !== true) {
    return {
      ok: false,
      blockedBy: 'cleanup_not_available',
      redirectHref: status?.nextHref || appendDemoEventId('/dashboard?guide=dashboard-demo', status?.demoEventId),
    };
  }

  return { ok: true };
}
