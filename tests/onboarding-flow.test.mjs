import test from 'node:test';
import assert from 'node:assert/strict';
import { ONBOARDING_FLOW_STEPS, buildOnboardingFlowStatus, canStartOnboardingGuide } from '../lib/onboarding/onboarding-flow.js';
import { getNextOnboardingStep } from '../lib/onboarding/getNextOnboardingStep.js';

test('onboarding curto: 1 passo essencial + 5 itens contextuais, sem etapas fictícias', () => {
  const keys = ONBOARDING_FLOW_STEPS.map((step) => step.key);
  assert.deepEqual(keys, ['essentials', 'event_type', 'contract_template', 'musician', 'first_event', 'precontract', 'complete']);
  assert.ok(!keys.some((key) => /fake|demo|cleanup/.test(key)));
});

test('progresso deriva de fatos e é retomável', () => {
  const status = { essentialsCompleted: true, hasEventType: true, hasContractTemplate: false };
  assert.equal(buildOnboardingFlowStatus(status).nextStep, 'contract_template');
  const { summary, nextStep } = getNextOnboardingStep(status);
  assert.equal(nextStep.key, 'contract_template');
  assert.equal(summary.completed, 2);
  assert.equal(summary.total, 6);
});

test('tudo feito → concluído; guias nunca bloqueiam navegação', () => {
  const all = { essentialsCompleted: true, hasEventType: true, hasContractTemplate: true, hasMusician: true, hasEvent: true, hasPrecontract: true, isComplete: true };
  assert.equal(getNextOnboardingStep(all).isComplete, true);
  assert.equal(canStartOnboardingGuide({}, 'precontract').ok, true);
});
