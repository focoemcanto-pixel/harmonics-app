const STEP_RESTART_ROUTES = {
  template_contract: '/contratos/templates?guide=template&onboarding=resume',
  event_types: '/configuracoes/tipos-eventos?guide=event-types&onboarding=resume',
  precontract: '/pre-contratos?guide=precontract&onboarding=resume',
  client_experience: '/contrato/[token]?guide=client-contract&onboarding=resume',
  event_operational: '/eventos?guide=event&onboarding=resume',
  automation: '/automacao?guide=automation&onboarding=resume',
  team: '/contatos?guide=team&onboarding=resume',
};

const LEGACY_STEP_KEY_ALIAS = {
  workspace_configured: 'template_contract',
  template_created: 'template_contract',
  event_type_created: 'event_types',
  precontract_created: 'precontract',
  contract_signed_test: 'client_experience',
  first_event_created: 'event_operational',
  automation_configured: 'automation',
  team_configured: 'team',
};

export function restartOnboardingStep(stepKey, fallbackHref = '/settings/onboarding') {
  const normalizedKey = LEGACY_STEP_KEY_ALIAS[stepKey] || stepKey;
  return STEP_RESTART_ROUTES[normalizedKey] || fallbackHref;
}

export { STEP_RESTART_ROUTES, LEGACY_STEP_KEY_ALIAS };
