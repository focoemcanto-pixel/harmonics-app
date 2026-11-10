// Portão geográfico compartilhado por consultar_precos e calcular_orcamento (sem dependência circular).
import { locationGate } from '../commercial/geo.mjs';
import { flagRegionPricing } from '../commercial/pricing.mjs';

export const CUSTOM_GUIDANCE = 'Orçamento personalizado (outro estado/viagem longa/logística especial): não informe valores, distâncias nem tempos. A resposta fixa já diz que a equipe confirma e retorna.';

/**
 * Inteligência geográfica antes de qualquer valor (pesquisas/cálculos ficam internos):
 * só o nome do espaço => pergunta a cidade (nunca presume a região-base); texto ambíguo => pede endereço ou
 * localização; outro estado => orçamento personalizado com pendência para o Owner. Senão segue com o local combinado.
 */
export async function applyLocationGate(ctx, { local, cidade, areas, date }) {
  const g = locationGate({ local, cidade, areas });
  if (g.action === 'missing') return { stop: { ok: false, erro: 'local_necessario', orientacao: 'Antes de passar valores, peça só o local do evento (cidade/espaço). Os valores dependem da região.' } };
  if (g.action === 'ask') {
    if (ctx.effects) ctx.effects.regionPendingText = g.text;
    return { stop: { ok: false, erro: g.reason, orientacao: 'Não informe valores nem presuma a cidade. A pergunta fixa já vai para a cliente.' } };
  }
  if (g.action === 'custom') {
    await flagRegionPricing({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, conversationId: ctx.conversation?.id, location: g.location, date, reason: g.reason });
    if (ctx.effects) ctx.effects.regionPendingText = g.text;
    return { stop: { ok: false, erro: 'orcamento_personalizado', orientacao: CUSTOM_GUIDANCE } };
  }
  return { location: g.location };
}

