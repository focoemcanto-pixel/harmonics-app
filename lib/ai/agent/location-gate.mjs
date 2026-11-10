// Portão geográfico compartilhado por consultar_precos e calcular_orcamento (sem dependência circular).
import { locationGate } from '../commercial/geo.mjs';
import { flagRegionPricing } from '../commercial/pricing.mjs';
import { venueReport, splitVenueText, venueKey, norm as venueNorm } from '../commercial/venues.mjs';
import { lookupVenueOnline } from '../commercial/venue-online.mjs';
import { lookupVenueWeb } from '../commercial/venue-web-search.mjs';

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

/**
 * Busque online antes de pedir endereço a alguém que já informou espaço e cidade.
 * O resultado exato não inventa distância ou tarifa: ainda passa pelo motor de localidades.
 * A consulta é pública, limitada e isolada quando chamada pelo simulador.
 */
export async function resolveVenueWithOnlineLookup({ local, cidade, areas = [], venues = [], searchFn = lookupVenueOnline, webSearchFn = null } = {}) {
  const initial = locationGate({ local, cidade, areas, venues });
  if (initial.action !== 'ask' || initial.reason !== 'espaco_nao_verificado') {
    return { gate: initial, lookup: null, verified: null };
  }
  const parts = splitVenueText(local, cidade);
  const first = await searchFn({ venue: parts.venue, city: parts.city });
  // Somente uma consulta complementar quando a fonte gratuita não identifica o espaço.
  const search = first?.status !== 'found' && first?.status !== 'ambiguous' && typeof webSearchFn === 'function'
    ? await webSearchFn({ venue: parts.venue, city: parts.city })
    : first;
  if (search?.status === 'found' && search.venue?.uf) {
    const v = search.venue;
    const record = {
      name: parts.venue, name_norm: venueKey(parts.venue),
      city: parts.city, city_norm: venueNorm(parts.city), uf: v.uf,
      address: v.address, lat: v.lat, lng: v.lng,
      status: 'verified', source: 'maps', verified_at: new Date().toISOString(),
      notes: 'Fonte de identificação: ' + (search.attribution || 'OpenStreetMap') + '. ' + (v.sourceUrl || ''),
      aliases: [],
    };
    const gate = locationGate({ local, cidade, areas, venues: [...venues, record] });
    return { gate, lookup: search, verified: gate.action === 'proceed' || gate.action === 'custom' ? record : null };
  }
  if (search?.status === 'ambiguous') return { gate: { ...initial,
    text: 'Encontrei mais de um resultado parecido para esse espaço. Você consegue me enviar a localização certinha para eu conferir? ☺️'
  }, lookup: search, verified: null };
  if (search?.status === 'not_found') return { gate: { ...initial,
    text: 'Não consegui localizar esse espaço na pesquisa pelo nome e pela cidade. Você poderia me enviar a localização certinha pra eu conferir? ☺️'
  }, lookup: search, verified: null };
  return { gate: { ...initial,
    text: 'Não consegui confirmar esse espaço na pesquisa agora. Você consegue me mandar a localização dele pra eu conferir? ☺️'
  }, lookup: search || { status: 'unavailable' }, verified: null };
}

async function persistOnlineVenue(ctx, record) {
  if (!record || !ctx?.workspaceId) return;
  try {
    const query = ctx.supabase.from('ai_venues').select('id,status')
      .eq('workspace_id', ctx.workspaceId).eq('name_norm', record.name_norm)
      .eq('city_norm', record.city_norm).eq('uf', record.uf).limit(1);
    const { data } = await query;
    const existing = (data || [])[0];
    if (existing?.status === 'verified' || existing?.status === 'rejected') return;
    const payload = { ...record, workspace_id: ctx.workspaceId };
    if (existing) {
      await ctx.supabase.from('ai_venues').update(payload).eq('id', existing.id).eq('workspace_id', ctx.workspaceId);
    } else {
      await ctx.supabase.from('ai_venues').insert(payload);
    }
  } catch { /* A pesquisa não pode impedir o atendimento se a memória falhar. */ }
}

export async function applyLocationGate(ctx, { local, cidade, areas, date, initial = false }) {
  const venues = await loadVenues(ctx);
  const { gate: venueGate, verified, lookup } = await resolveVenueWithOnlineLookup({
    local, cidade, areas, venues,
    searchFn: ctx.venueSearchFn || (process.env.CI ? async () => ({ status: 'unavailable' }) : lookupVenueOnline),
    webSearchFn: ctx.venueWebSearchFn || (process.env.AI_VENUE_WEB_SEARCH_ENABLED === 'true' && !process.env.CI ? lookupVenueWeb : null),
  });
  // The declared city owns initial regional pricing. A venue name or an
  // inconclusive/ambiguous venue lookup cannot override that commercial region.
  const g = initial && String(cidade || '').trim()
    ? locationGate({ local: cidade, cidade, areas, venues: [] }) : venueGate;
  if (initial && venueGate.action === 'ask' && ctx.effects) ctx.effects.venueAddressPending = true;
  if (lookup && ctx.effects) ctx.effects.venueSearchStatus = lookup.status;
  if (verified) await persistOnlineVenue(ctx, verified);
  // Mesmo precisando confirmar o endereço, guarde o relato de espaço+cidade para revisão.
  // Isso não libera preços nem marca o espaço como verificado.
  if (g.action === 'ask' && g.reason === 'espaco_nao_verificado') {
    await rememberVenue(ctx, venueReport({ local, cidade, analysis: g.analysis, conversationId: ctx.conversation?.id || null }));
  }
  if (!g.venue && (g.action === 'proceed' || g.action === 'custom')) {
    await rememberVenue(ctx, venueReport({ local, cidade, analysis: g.analysis || { kind: g.action === 'custom' ? 'other_state' : 'unregistered' }, conversationId: ctx.conversation?.id || null }));
  }
  if (g.action === 'missing') return { stop: { ok: false, erro: 'local_necessario', orientacao: 'Antes de passar valores, peça só o local do evento (cidade/espaço). Os valores dependem da região.' } };
  if (g.action === 'ask') {
    // Para orçamento INICIAL, a cidade declarada basta para identificar a tabela aprovada.
    // Pesquisa do espaço continua auxiliar; endereço exato será solicitado na contratação.
    // Sem cidade, continuamos perguntando; cidade não cadastrada continua bloqueada pelo pricing.
    if (g.reason === 'espaco_nao_verificado' && String(cidade || '').trim()) {
      if (ctx.effects) ctx.effects.venueAddressPending = true;
      return { location: String(cidade).trim() };
    }
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


