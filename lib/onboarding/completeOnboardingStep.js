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

    const response = await fetch('/api/onboarding/progress', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        stepKey,
        completed,
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
