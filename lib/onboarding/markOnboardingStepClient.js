import { getSupabase } from '@/lib/supabase';
import { ONBOARDING_FLOW_STEPS } from '@/lib/onboarding/onboarding-flow';

const FLOW_STEP_KEYS = new Set(ONBOARDING_FLOW_STEPS.map((step) => step.key));

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

export async function markOnboardingStepClient(stepKey, completed = true) {
  const normalizedStepKey = String(stepKey || '').trim();
  const guide = LEGACY_STEP_TO_GUIDE[normalizedStepKey] || normalizedStepKey;

  if (!FLOW_STEP_KEYS.has(normalizedStepKey) && !LEGACY_STEP_TO_GUIDE[normalizedStepKey]) {
    return { ok: false, skipped: true, error: 'invalid_step_key' };
  }

  try {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || null;
    if (!token) return { ok: false, skipped: true, error: 'missing_session' };

    const flowStateKey = completed ? LEGACY_STEP_TO_FLOW_STATE[normalizedStepKey] : null;

    const response = await fetch('/api/onboarding/flow-status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        guide,
        ...(flowStateKey ? { flowState: { [flowStateKey]: true } } : {}),
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      return { ok: false, error: payload?.error || 'request_failed' };
    }

    return { ok: true, progress: payload.progress, flow: payload };
  } catch (error) {
    return { ok: false, error: error?.message || 'unknown_error' };
  }
}
