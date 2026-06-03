import { ONBOARDING_FLOW_STEPS } from '@/lib/onboarding/onboarding-flow';

const visibleFlowSteps = ONBOARDING_FLOW_STEPS.filter((step) => step.key !== 'complete');

function isFlowStepDone(step, status = {}) {
  if (status.completed === true || status.skipped === true) return true;
  if (step.key === 'dashboard') return status.onboardingEnabled === true || status.primaryWorkspace === true;
  if (!step.flag) return false;
  return status?.[step.flag] === true;
}

export function calculateOnboardingFlowProgress(status = {}) {
  const total = visibleFlowSteps.length;
  const completed = visibleFlowSteps.filter((step) => isFlowStepDone(step, status)).length;

  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export function getNextOnboardingStep(status = {}) {
  const nextStep = visibleFlowSteps.find((step) => !isFlowStepDone(step, status)) || null;
  const summary = calculateOnboardingFlowProgress(status);

  return {
    nextStep,
    summary,
    isComplete: !nextStep,
  };
}

export function getOnboardingStepByKey(stepKey) {
  const normalized = String(stepKey || '').trim();
  return visibleFlowSteps.find((step) => step.key === normalized) || null;
}

export { visibleFlowSteps as ONBOARDING_VISIBLE_FLOW_STEPS };
