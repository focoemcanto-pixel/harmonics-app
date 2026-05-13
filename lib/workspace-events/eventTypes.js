export const WORKSPACE_EVENT_TYPES = Object.freeze({
  WORKSPACE_CONFIGURED: 'workspace.configured',
  TEMPLATE_CREATED: 'template.created',
  EVENT_TYPE_CREATED: 'event_type.created',
  PRECONTRACT_CREATED: 'precontract.created',
  CONTRACT_SIGNED: 'contract.signed',
  EVENT_CREATED: 'event.created',
  AUTOMATION_CHANNEL_CONNECTED: 'automation.channel_connected',
  TEAM_MEMBER_INVITED: 'team.member_invited',
});

export const ONBOARDING_STEP_BY_WORKSPACE_EVENT = Object.freeze({
  [WORKSPACE_EVENT_TYPES.WORKSPACE_CONFIGURED]: 'workspace_configured',
  [WORKSPACE_EVENT_TYPES.TEMPLATE_CREATED]: 'template_created',
  [WORKSPACE_EVENT_TYPES.EVENT_TYPE_CREATED]: 'event_type_created',
  [WORKSPACE_EVENT_TYPES.PRECONTRACT_CREATED]: 'precontract_created',
  [WORKSPACE_EVENT_TYPES.CONTRACT_SIGNED]: 'contract_signed_test',
  [WORKSPACE_EVENT_TYPES.EVENT_CREATED]: 'first_event_created',
  [WORKSPACE_EVENT_TYPES.AUTOMATION_CHANNEL_CONNECTED]: 'automation_configured',
  [WORKSPACE_EVENT_TYPES.TEAM_MEMBER_INVITED]: 'team_configured',
});

export function getOnboardingStepForWorkspaceEvent(type) {
  return ONBOARDING_STEP_BY_WORKSPACE_EVENT[String(type || '').trim()] || null;
}
