const LEGACY_STEP_TO_GUIDE = {
  workspace_configured: 'dashboard-demo',
  template_created: 'template',
  event_type_created: 'event-types',
  precontract_created: 'precontract',
  contract_signed_test: 'client-contract-success',
  first_event_created: 'scale-with-formation',
  automation_configured: 'automation-overview',
  team_configured: 'fake-members',
};

const LEGACY_STEP_TO_FLOW_STATE = {
  workspace_configured: 'workspace_created_for_onboarding',
  template_created: 'contract_template_completed',
  contract_signed_test: 'client_contract_signed',
};

export async function completeOnboardingStep({
  supabase,
  accessToken,
  stepKey,
  completed = true,
}) {
  try {
    if (!supabase || !accessToken || !stepKey) {
      return { ok: false, skipped: true };
    }

    const normalizedStepKey = String(stepKey || '').trim();
    const guide = LEGACY_STEP_TO_GUIDE[normalizedStepKey] || normalizedStepKey;
    const flowStateKey = completed ? LEGACY_STEP_TO_FLOW_STATE[normalizedStepKey] : null;

    const response = await fetch('/api/onboarding/flow-status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        guide,
        ...(flowStateKey ? { flowState: { [flowStateKey]: true } } : {}),
      }),
    });

    const payload = await response.json().catch(() => null);

    return {
      ok: response.ok,
      payload,
    };
  } catch (error) {
    console.warn('[ONBOARDING][COMPLETE_STEP_ERROR]', {
      message: error?.message,
      stepKey,
    });

    return {
      ok: false,
      error,
    };
  }
}
