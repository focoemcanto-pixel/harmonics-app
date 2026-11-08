/** Métricas comerciais (agregadas, sem dados pessoais). */
export const STAGES = ['new', 'qualifying', 'proposal', 'negotiation', 'closing', 'contract_sent', 'won', 'lost', 'post_sale'];

export function summarizePipeline({ conversations = [], stageEvents = [], followups = [], usage = [], outbox = [], approvals = [] }) {
  const byStage = Object.fromEntries(STAGES.map((s) => [s, 0]));
  for (const c of conversations) byStage[c.sales_stage] = (byStage[c.sales_stage] || 0) + 1;
  const leads = conversations.length;
  const converted = conversations.filter((c) => ['contract_sent', 'won', 'post_sale'].includes(c.sales_stage)).length;
  const lostReasons = {};
  for (const c of conversations) if (c.sales_stage === 'lost') lostReasons[c.lost_reason || 'não informado'] = (lostReasons[c.lost_reason || 'não informado'] || 0) + 1;
  const objections = {};
  for (const c of conversations) for (const o of c.objections || []) objections[o] = (objections[o] || 0) + 1;
  const fuSent = followups.filter((f) => f.status === 'sent');
  const recovered = fuSent.filter((f) => f.recovered).length;
  const aiOut = outbox.filter((o) => o.sender_type === 'ai');
  const drafts = aiOut.filter((o) => ['draft', 'cancelled'].includes(o.status) || o.last_error === 'discarded');
  const tokensIn = usage.reduce((s, u) => s + Number(u.input_tokens || 0), 0);
  const tokensOut = usage.reduce((s, u) => s + Number(u.output_tokens || 0), 0);
  const cost = usage.reduce((s, u) => s + Number(u.cost_usd || 0), 0);
  return {
    leads, byStage, conversionRate: leads ? Math.round((converted / leads) * 1000) / 10 : 0,
    lostReasons, objections,
    followups: { scheduled: followups.filter((f) => f.status === 'scheduled').length, sent: fuSent.length, recovered, recoveryRate: fuSent.length ? Math.round((recovered / fuSent.length) * 1000) / 10 : 0 },
    quality: {
      aiMessages: aiOut.filter((o) => o.status === 'sent').length,
      discardedDrafts: aiOut.filter((o) => o.last_error === 'discarded').length,
      handoffs: conversations.filter((c) => c.needs_human).length,
      pendingApprovals: approvals.filter((a) => a.status === 'pending').length,
      draftsReviewed: drafts.length,
    },
    cost: { usd: Math.round(cost * 10000) / 10000, tokensIn, tokensOut, replies: usage.filter((u) => u.kind === 'reply').length },
    stageTransitions: stageEvents.length,
  };
}
