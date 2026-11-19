import { simulationClosingSignature } from './closing.mjs';

export const SIMULATION_SESSIONS = 'ai_simulation_sessions';
export const SIMULATION_VALIDITY_MS = 15 * 24 * 60 * 60 * 1000;
export const isSimulationId = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export const supervisionEnabled = () => process.env.AI_NARA_SUPERVISED_SIMULATION === 'true';

export function requestSimulationReview(closing, lead, previousReply, text) {
  if (String(text).trim().toUpperCase() !== 'CONFIRMO' || closing?.status !== 'awaiting_confirmation'
    || !closing.summary || previousReply !== closing.lastReply
    || closing.signature !== simulationClosingSignature(lead)) return null;
  return { status: 'awaiting_approval', summary: closing.summary, text: closing.lastReply, signature: closing.signature };
}

export function decideSimulationReview(state, { action, reason, actor, now = new Date() }) {
  const closing = state.closing;
  if (action === 'expire') {
    if (closing?.status !== 'approved') return null;
    return { ...state, closing: { ...closing, testExpiredAt: now.toISOString() } };
  }
  if (closing?.status !== 'awaiting_approval' || closing.signature !== simulationClosingSignature(state.lead)) return null;
  const record = { ...closing, decidedBy: actor, decidedAt: now.toISOString() };
  let content;
  if (action === 'approve') {
    Object.assign(record, { status: 'approved', token: crypto.randomUUID(), expiresAt: new Date(now.getTime() + SIMULATION_VALIDITY_MS).toISOString() });
    content = 'A equipe aprovou os dados. Abra o link de teste abaixo. No atendimento real, você teria 15 dias para ler, preencher e assinar o pré-contrato.';
  } else if (action === 'adjust' || action === 'reject') {
    if (!reason) return null;
    Object.assign(record, { status: action === 'adjust' ? 'changes_requested' : 'rejected', reason });
    content = action === 'adjust'
      ? 'A equipe pediu um ajuste antes de seguir: ' + reason + '. Depois de revisar, vamos conferir e confirmar um novo resumo.'
      : 'A equipe não aprovou esta solicitação: ' + reason + '.';
  } else return null;
  const link = record.token ? '/api/ai/commercial/simulation-supervision?id=' + state.id + '&token=' + record.token : undefined;
  return { ...state, closing: record, messages: [...state.messages, { role: 'assistant', content, link }] };
}

export function simulationLinkStatus(closing, token, now = new Date()) {
  if (closing?.status !== 'approved' || !closing.token || closing.token !== token) return 404;
  const expires = Date.parse(closing.expiresAt);
  return !Number.isFinite(expires) || now.getTime() >= expires || closing.testExpiredAt ? 410 : 200;
}
