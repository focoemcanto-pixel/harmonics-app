import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_OWNER, canPrepareAiResponse, canDispatchAiResponse, isHumanTakeoverEvent } from '../../lib/ai/hybrid-ownership.mjs';

const conversation = {
  id: 'conversation-1',
  workspace_id: 'workspace-1',
  owner: AI_OWNER.AI,
  ai_enabled: true,
  owner_version: 4,
  state: 'open',
};
const outbound = {
  conversation_id: 'conversation-1',
  workspace_id: 'workspace-1',
  owner_version: 4,
  status: 'pending',
  idempotency_key: 'msg-1',
};

test('AI is off unless explicitly enabled and owns an open conversation', () => {
  assert.equal(canPrepareAiResponse(conversation), true);
  assert.equal(canPrepareAiResponse({ ...conversation, ai_enabled: false }), false);
  assert.equal(canPrepareAiResponse({ ...conversation, owner: AI_OWNER.HUMAN }), false);
  assert.equal(canPrepareAiResponse({ ...conversation, state: 'closed' }), false);
  assert.equal(canPrepareAiResponse(null), false);
});

test('AI outbound message requires matching workspace, version and pending state', () => {
  assert.equal(canDispatchAiResponse(conversation, outbound), true);
  assert.equal(canDispatchAiResponse({ ...conversation, owner: 'human' }, outbound), false);
  assert.equal(canDispatchAiResponse({ ...conversation, owner_version: 5 }, outbound), false);
  assert.equal(canDispatchAiResponse(conversation, { ...outbound, workspace_id: 'other' }), false);
  assert.equal(canDispatchAiResponse(conversation, { ...outbound, conversation_id: 'other' }), false);
  assert.equal(canDispatchAiResponse(conversation, { ...outbound, status: 'cancelled' }), false);
  assert.equal(canDispatchAiResponse(conversation, { ...outbound, idempotency_key: '' }), false);
});

test('only explicit Business App echo triggers human takeover', () => {
  assert.equal(isHumanTakeoverEvent({ type: 'smb_message_echo', origin: 'business_app' }), true);
  assert.equal(isHumanTakeoverEvent({ type: 'outbound', origin: 'api' }), false);
  assert.equal(isHumanTakeoverEvent(null), false);
});
