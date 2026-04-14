import { getSupabaseAdmin } from '../supabase-admin';
import { getTargetDateForRule } from './date-matches-rule';

/**
 * Retorna entidades elegíveis para automação por data.
 *
 * Para cada eventType, busca no banco eventos cujo event_date corresponde
 * ao timing da regra (days_before ou days_after), aplicando os critérios
 * específicos de elegibilidade de cada automação.
 *
 * @param {string} eventType - tipo do evento de automação
 * @param {Object} rule - regra com days_before e/ou days_after
 * @returns {Promise<string[]>} lista de entityIds elegíveis (event_id para todos estes tipos)
 */
export async function getScheduledCandidates(eventType, rule) {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    switch (eventType) {
      case 'repertoire_pending_15_days_client': {
        const targetDate = getTargetDateForRule(rule);
        if (!targetDate) return [];
        return await getRepertoirePendingCandidates(supabaseAdmin, targetDate);
      }

      case 'payment_pending_2_days_client': {
        const targetDate = getTargetDateForRule(rule);
        if (!targetDate) return [];
        return await getPaymentPendingCandidates(supabaseAdmin, targetDate);
      }

      case 'post_event_review_request_client':
        return await getPostEventReviewCandidates(supabaseAdmin, rule);

      case 'schedule_pending_15_days_admin': {
        const targetDate = getTargetDateForRule(rule);
        if (!targetDate) return [];
        return await getSchedulePendingAdminCandidates(supabaseAdmin, targetDate);
      }

      default:
        return [];
    }
  } catch (err) {
    console.error(`[getScheduledCandidates] Erro para ${eventType}:`, err);
    return [];
  }
}

/**
 * repertoire_pending_15_days_client:
 * - eventos com event_date == targetDate
 * - repertório ainda não finalizado (repertoire_config.status != 'FINALIZADO' ou sem config)
 * - cliente com telefone cadastrado (via precontracts)
 */
async function getRepertoirePendingCandidates(supabase, targetDate) {
  const { data: events, error } = await supabase
    .from('events')
    .select('id')
    .eq('event_date', targetDate)
    .neq('status', 'cancelled');

  if (error || !events?.length) return [];

  const eventIds = events.map((e) => e.id);

  // Excluir eventos com repertório já finalizado
  const { data: finalizedRepertoires } = await supabase
    .from('repertoire_config')
    .select('event_id, status')
    .in('event_id', eventIds)
    .in('status', ['FINALIZADO', 'ENVIADO', 'CONCLUIDO', 'ENVIADO_TRANCADO']);

  const finalizedEventIds = new Set((finalizedRepertoires || []).map((r) => r.event_id));
  const pendingEventIds = eventIds.filter((id) => !finalizedEventIds.has(id));

  if (!pendingEventIds.length) return [];

  // Filtrar apenas eventos cujo cliente possui telefone
  const { data: precontracts } = await supabase
    .from('precontracts')
    .select('event_id')
    .in('event_id', pendingEventIds)
    .not('client_phone', 'is', null)
    .neq('client_phone', '');

  return (precontracts || []).map((p) => p.event_id);
}

/**
 * payment_pending_2_days_client:
 * - eventos com event_date == targetDate
 * - saldo pendente (open_amount > 0)
 * - cliente com telefone cadastrado (via precontracts)
 */
async function getPaymentPendingCandidates(supabase, targetDate) {
  const { data: events, error } = await supabase
    .from('events')
    .select('id')
    .eq('event_date', targetDate)
    .gt('open_amount', 0)
    .neq('status', 'cancelled');

  if (error || !events?.length) return [];

  const eventIds = events.map((e) => e.id);

  // Filtrar apenas eventos cujo cliente possui telefone
  const { data: precontracts } = await supabase
    .from('precontracts')
    .select('event_id')
    .in('event_id', eventIds)
    .not('client_phone', 'is', null)
    .neq('client_phone', '');

  return (precontracts || []).map((p) => p.event_id);
}

/**
 * post_event_review_request_client:
 * - eventos já encerrados há pelo menos delay_hours (default 24h)
 * - opcionalmente limita janela por days_after para evitar envios antigos
 * - review ainda não submetido para o evento
 * - cliente com telefone e public_token (acesso ao painel)
 */
async function getPostEventReviewCandidates(supabase, rule) {
  const delayHours = Number.isFinite(Number(rule?.delay_hours))
    ? Math.max(1, Number(rule.delay_hours))
    : 24;

  const windowHours = Number.isFinite(Number(rule?.days_after))
    ? Math.max(1, Number(rule.days_after) * 24)
    : null;

  const { data: events, error } = await supabase
    .from('events')
    .select('id, event_date, event_time')
    .neq('status', 'cancelled');

  if (error || !events?.length) return [];

  const now = Date.now();
  const eligibleByDelay = (events || []).filter((event) => {
    if (!event?.event_date) return false;

    const eventDateTime = new Date(
      `${event.event_date}T${event.event_time ? String(event.event_time).slice(0, 5) : '00:00'}:00-03:00`
    ).getTime();

    if (!Number.isFinite(eventDateTime)) return false;

    const elapsedHours = (now - eventDateTime) / (1000 * 60 * 60);
    if (elapsedHours < delayHours) return false;
    if (windowHours != null && elapsedHours > windowHours + 24) return false;
    return true;
  });

  if (!eligibleByDelay.length) return [];
  const eventIds = eligibleByDelay.map((e) => e.id);

  // Excluir eventos que já possuem avaliação
  const { data: reviews } = await supabase
    .from('client_reviews')
    .select('event_id')
    .in('event_id', eventIds);

  const reviewedEventIds = new Set((reviews || []).map((r) => r.event_id));
  const unreviewedEventIds = eventIds.filter((id) => !reviewedEventIds.has(id));

  if (!unreviewedEventIds.length) return [];

  // Filtrar apenas eventos cujo cliente possui telefone e public_token
  const { data: precontracts } = await supabase
    .from('precontracts')
    .select('event_id')
    .in('event_id', unreviewedEventIds)
    .not('client_phone', 'is', null)
    .neq('client_phone', '')
    .not('public_token', 'is', null)
    .neq('public_token', '');

  return (precontracts || []).map((p) => p.event_id);
}

/**
 * schedule_pending_15_days_admin:
 * - eventos com event_date == targetDate
 * - existem convites pendentes na escala (invites.status = 'pending')
 */
async function getSchedulePendingAdminCandidates(supabase, targetDate) {
  const { data: events, error } = await supabase
    .from('events')
    .select('id')
    .eq('event_date', targetDate)
    .neq('status', 'cancelled');

  if (error || !events?.length) return [];

  const eventIds = events.map((e) => e.id);

  // Filtrar apenas eventos com convites ainda pendentes
  const { data: pendingInvites } = await supabase
    .from('invites')
    .select('event_id')
    .in('event_id', eventIds)
    .eq('status', 'pending');

  if (!pendingInvites?.length) return [];

  // Retornar IDs únicos de eventos com pendências
  return [...new Set(pendingInvites.map((i) => i.event_id))];
}
