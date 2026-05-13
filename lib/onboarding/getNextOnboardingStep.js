import { ONBOARDING_STEPS, calculateOnboardingProgress } from '@/lib/onboarding/tourRegistry';

export function getNextOnboardingStep(progress = {}) {
  const nextStep = ONBOARDING_STEPS.find((step) => progress?.[step.key] !== true) || null;
  const summary = calculateOnboardingProgress(progress);

  return {
    nextStep,
    summary,
    isComplete: !nextStep,
  };
}

export function getOnboardingStepByKey(stepKey) {
  const normalized = String(stepKey || '').trim();
  return ONBOARDING_STEPS.find((step) => step.key === normalized) || null;
}
