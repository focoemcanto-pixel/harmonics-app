import { getSupabase } from '@/lib/supabase';
import { ONBOARDING_STEPS } from '@/lib/onboarding/tourRegistry';

const VALID_STEP_KEYS = new Set(ONBOARDING_STEPS.map((step) => step.key));

export async function markOnboardingStepClient(stepKey, completed = true) {
  const normalizedStepKey = String(stepKey || '').trim();
  if (!VALID_STEP_KEYS.has(normalizedStepKey)) {
    return { ok: false, skipped: true, error: 'invalid_step_key' };
  }

  try {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || null;
    if (!token) return { ok: false, skipped: true, error: 'missing_session' };

    const response = await fetch('/api/onboarding/progress', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ stepKey: normalizedStepKey, completed }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      return { ok: false, error: payload?.error || 'request_failed' };
    }

    return { ok: true, progress: payload.progress, summary: payload.summary };
  } catch (error) {
    return { ok: false, error: error?.message || 'unknown_error' };
  }
}
