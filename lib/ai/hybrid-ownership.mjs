/**
 * Harmonics AI hybrid ownership rules.
 * Pure, provider-independent guards. The actual dispatch must claim a DB lease
 * and re-check ownership/version within the same transactional boundary.
 * This module deliberately does not call WhatsApp or switch on the AI.
 */
export const AI_OWNER = Object.freeze({ HUMAN: 'human', AI: 'ai' });

export function canPrepareAiResponse(conversation) {
  return Boolean(
    conversation &&
    conversation.ai_enabled === true &&
    conversation.owner === AI_OWNER.AI &&
    conversation.state === 'open' &&
    Number.isSafeInteger(Number(conversation.owner_version)) &&
    Number(conversation.owner_version) > 0
  );
}

export function canDispatchAiResponse(conversation, outboxRow) {
  if (!canPrepareAiResponse(conversation) || !outboxRow) return false;
  return (
    outboxRow.status === 'pending' &&
    outboxRow.workspace_id === conversation.workspace_id &&
    outboxRow.conversation_id === conversation.id &&
    Number(outboxRow.owner_version) === Number(conversation.owner_version) &&
    typeof outboxRow.idempotency_key === 'string' &&
    outboxRow.idempotency_key.length > 0
  );
}

export function isHumanTakeoverEvent(event) {
  // Echo from the Business App is considered human; outgoing AI messages must
  // be identified by our own provider message IDs to avoid false takeovers.
  return event?.type === 'smb_message_echo' && event?.origin === 'business_app';
}
