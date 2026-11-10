// Portão geográfico compartilhado por consultar_precos e calcular_orcamento (sem dependência circular).
import { locationGate } from '../commercial/geo.mjs';
import { flagRegionPricing } from '../commercial/pricing.mjs';
import { venueReport } from '../commercial/venues.mjs';

export const CUSTOM_GUIDANCE = 'Orçamento personalizado (outro estado/viagem longa/logística especial): não informe valores, distâncias nem tempos. A resposta fixa já diz que a equipe confirma e retorna.';

/**
 * Inteligência geográfica antes de qualquer valor (pesquisas/cálculos ficam internos):
 * só o nome do espaço => pergunta a cidade (nunca presume a região-base); texto ambíguo => pede endereço ou
 * localização; outro estado => orçamento personalizado com pendência para o Owner. Senão segue com o local combinado.
 */
/** Espaços da memória permanente (tolerante: sem a tabela, segue sem memória). */
export async function loadVenues(ctx) {
  try {
    const { data, error } = await ctx.supabase.from('ai_venues').select('*').eq('workspace_id', ctx.workspaceId).neq('status', 'rejected');
    return error ? [] : data || [];
  } catch { return []; }
}

/** Registra (sem duplicar) o espaço que a cliente informou com a cidade, para o Owner conferir na Central. */
export async function rememberVenue(ctx, report) {
  if (!report || !ctx?.workspaceId) return;
  try {
    const { data: existing } = await ctx.supabase.from('ai_venues').select('id, mentions')
      .eq('workspace_id', ctx.workspaceId).eq('name_norm', report.name_norm).eq('city_norm', report.city_norm).eq('uf', report.uf).limit(1);
    const row = (existing || [])[0];
    if (row) {
      await ctx.supabase.from('ai_venues').update({ mentions: (Number(row.mentions) || 0) + 1, last_conversation_id: report.last_conversation_id, updated_at: new Date().toISOString() }).eq('id', row.id).eq('workspace_id', ctx.workspaceId);
    } else {
      await ctx.supabase.from('ai_venues').insert({ ...report, workspace_id: ctx.workspaceId });
    }
  } catch { /* memória é auxiliar: nunca bloqueia o atendimento */ }
}

export async function applyLocationGate(ctx, { local, cidade, areas, date }) {
  const venues = await loadVenues(ctx);
  const g = locationGate({ local, cidade, areas, venues });
  if (!g.venue && (g.action === 'proceed' || g.action === 'custom')) {
    await rememberVenue(ctx, venueReport({ local, cidade, analysis: g.analysis || { kind: g.action === 'custom' ? 'other_state' : 'unregistered' }, conversationId: ctx.conversation?.id || null }));
  }
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

