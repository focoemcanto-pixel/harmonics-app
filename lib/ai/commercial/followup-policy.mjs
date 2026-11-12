// Nara follow-up policy. Pure, simulator-safe planning; never sends messages.
// Real dispatch requires the existing ai_followups scheduler, opt-in and approved templates.
export const NARA_FOLLOWUP_POLICY = Object.freeze({
  missing_details: Object.freeze({ delaysMinutes: [15], maxAttempts: 1 }),
  quote_sent: Object.freeze({ delaysMinutes: [1440, 4320], maxAttempts: 2 }),
});
export function planNaraFollowups({ stage, lastCustomerAt, referenceAt, customerReplied = false,
  optedOut = false, owner = 'ai', closed = false } = {}) {
  if (customerReplied || optedOut || closed || owner !== 'ai') return [];
  const policy = NARA_FOLLOWUP_POLICY[stage];
  const timestamp = Date.parse(referenceAt || lastCustomerAt || '');
  if (!policy || !Number.isFinite(timestamp)) return [];
  return policy.delaysMinutes.map((minutes, index) => ({
    kind: stage, step: index + 1,
    dueAt: new Date(timestamp + minutes * 60000).toISOString(),
    message: stage === 'missing_details'
      ? 'Oi! 😊 Conseguiu conferir os dados do evento? Me enviando a data e o local, já consigo te passar nossas opções e valores.'
      : index === 0
        ? 'Oi! 😊 Conseguiu conferir as opções e os valores que te enviei? Se tiver alguma dúvida ou quiser ajustar a formação, estou por aqui para ajudar!'
        : 'Oi! Passando só para saber se ainda posso te ajudar com a música do casamento. Se quiser continuar o orçamento, é só me chamar! 🎶',
  }));
}
