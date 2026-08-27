import { getSupabaseAdmin } from '../supabase-admin';
import { getTargetDateForRule } from './date-matches-rule';

function applyWorkspace(query, workspaceId) {
  return workspaceId ? query.eq('workspace_id', workspaceId) : query;
}

/**
 * Retorna entidades elegíveis para automação por data.
 *
 * IMPORTANTE: elegibilidade deve considerar o evento e seu estado operacional.
 * A resolução final do WhatsApp fica a cargo de resolveRecipient, que já sabe
 * usar precontract, contato vinculado ao evento e fallback salvo no evento.
 * Não exigir precontract aqui evita excluir contratos diretos silenciosamente.
 */
export async function getScheduledCandidates(eventType, rule) {
  const supabaseAdmin = getSupabaseAdmin();
  const workspaceId = rule?.workspace_id || null;

  try {
    switch (eventType) {
      case 'repertoire_pending_15_days_client': {
        const targetDate = getTargetDateForRule(rule);
        if (!targetDate) return [];
        return await getRepertoirePendingCandidates(supabaseAdmin, targetDate, workspaceId);
      }

      case 'payment_pending_2_days_client': {
        const targetDate = getTargetDateForRule(rule);
        if (!targetDate) return [];
        return await getPaymentPendingCandidates(supabaseAdmin, targetDate, workspaceId);
      }

      case 'post_event_review_request_client':
        return await getPostEventReviewCandidates(supabaseAdmin, rule, workspaceId);

      case 'schedule_pending_15_days_admin': {
        const targetDate = getTargetDateForRule(rule);
        if (!targetDate) return [];
        return await getSchedulePendingAdminCandidates(supabaseAdmin, targetDate, workspaceId);
      }

      case 'event_day_confirmation_client':
        return await getEventDayConfirmationCandidates(supabaseAdmin, workspaceId);

      default:
        return [];
    }
  } catch (err) {
    console.error(`[getScheduledCandidates] Erro para ${eventType}:`, err);
    // Não transformar erro real de consulta em "nenhum candidato". O cron precisa
    // registrar a falha para que o diagnóstico da Central seja confiável.
    throw err;
  }
}

/**
 * repertoire_pending_15_days_client:
 * - eventos com event_date == targetDate
 * - repertório ainda não finalizado
 * - telefone é resolvido depois pelo motor central
 */
async function getRepertoirePendingCandidates(supabase, targetDate, workspaceId) {
  let eventsQuery = supabase
    .from('events')
    .select('id')
    .eq('event_date', targetDate)
    .neq('status', 'cancelled');
  eventsQuery = applyWorkspace(eventsQuery, workspaceId);

  const { data: events, error } = await eventsQuery;
  if (error) throw error;
  if (!events?.length) return [];

  const eventIds = events.map((e) => e.id);

  const { data: finalizedRepertoires, error: repertoireError } = await supabase
    .from('repertoire_config')
    .select('event_id, status')
    .in('event_id', eventIds)
    .in('status', ['FINALIZADO', 'ENVIADO', 'CONCLUIDO', 'ENVIADO_TRANCADO']);

  if (repertoireError) throw repertoireError;

  const finalizedEventIds = new Set((finalizedRepertoires || []).map((r) => r.event_id));
  return eventIds.filter((id) => !finalizedEventIds.has(id));
}

/**
 * payment_pending_2_days_client:
 * - eventos com event_date == targetDate
 * - saldo pendente (open_amount > 0)
 * - telefone é resolvido depois pelo motor central
 */
async function getPaymentPendingCandidates(supabase, targetDate, workspaceId) {
  let query = supabase
    .from('events')
    .select('id')
    .eq('event_date', targetDate)
    .gt('open_amount', 0)
    .neq('status', 'cancelled');
  query = applyWorkspace(query, workspaceId);

  const { data: events, error } = await query;
  if (error) throw error;
  return (events || []).map((e) => e.id);
}

/**
 * post_event_review_request_client:
 * - evento já encerrado há pelo menos delay_hours
 * - review ainda não submetido
 * - resolução de telefone/token acontece no motor
 */
async function getPostEventReviewCandidates(supabase, rule, workspaceId) {
  const delayHours = Number.isFinite(Number(rule?.delay_hours))
    ? Math.max(1, Number(rule.delay_hours))
    : 24;

  const windowHours = Number.isFinite(Number(rule?.days_after))
    ? Math.max(1, Number(rule.days_after) * 24)
    : null;

  let query = supabase
    .from('events')
    .select('id, event_date, event_time')
    .neq('status', 'cancelled');
  query = applyWorkspace(query, workspaceId);

  const { data: events, error } = await query;
  if (error) throw error;
  if (!events?.length) return [];

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

  const { data: reviews, error: reviewError } = await supabase
    .from('client_reviews')
    .select('event_id')
    .in('event_id', eventIds);
  if (reviewError) throw reviewError;

  const reviewedEventIds = new Set((reviews || []).map((r) => r.event_id));
  return eventIds.filter((id) => !reviewedEventIds.has(id));
}

async function getSchedulePendingAdminCandidates(supabase, targetDate, workspaceId) {
  let query = supabase
    .from('events')
    .select('id')
    .eq('event_date', targetDate)
    .neq('status', 'cancelled');
  query = applyWorkspace(query, workspaceId);

  const { data: events, error } = await query;
  if (error) throw error;
  if (!events?.length) return [];

  const eventIds = events.map((e) => e.id);

  const { data: pendingInvites, error: inviteError } = await supabase
    .from('invites')
    .select('event_id')
    .in('event_id', eventIds)
    .eq('status', 'pending');
  if (inviteError) throw inviteError;
  if (!pendingInvites?.length) return [];

  return [...new Set(pendingInvites.map((i) => i.event_id))];
}

function buildSaoPauloNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const value = (type) => parts.find((p) => p.type === type)?.value || '00';
  const y = value('year');
  const m = value('month');
  const d = value('day');
  const hh = value('hour');
  const mm = value('minute');
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:00-03:00`);
}

function formatDateInSaoPaulo(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type) => parts.find((p) => p.type === type)?.value || '00';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function addBusinessWindowGuard(date) {
  const guarded = new Date(date.getTime());
  const hour = guarded.getHours();
  if (hour < 9) {
    guarded.setHours(9, 0, 0, 0);
  } else if (hour > 18 || (hour === 18 && guarded.getMinutes() > 0)) {
    guarded.setHours(18, 0, 0, 0);
  }
  return guarded;
}

async function getEventDayConfirmationCandidates(supabase, workspaceId) {
  const nowSp = buildSaoPauloNow();
  const todaySp = formatDateInSaoPaulo(new Date());
  const yesterdaySp = formatDateInSaoPaulo(new Date(Date.now() - 24 * 60 * 60 * 1000));

  let query = supabase
    .from('events')
    .select('id, event_date, event_time, status')
    .in('event_date', [todaySp, yesterdaySp])
    .neq('status', 'cancelled');
  query = applyWorkspace(query, workspaceId);

  const { data: events, error } = await query;
  if (error) throw error;
  if (!events?.length) return [];

  const eligible = [];
  for (const event of events) {
    if (!event?.event_date || !event?.event_time) continue;

    const timeStr = String(event.event_time).slice(0, 5);
    const [h, m] = timeStr.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) continue;

    const eventDateTime = new Date(`${event.event_date}T${timeStr}:00-03:00`);
    let scheduledAt;

    if (h < 14) {
      scheduledAt = new Date(eventDateTime.getTime());
      scheduledAt.setDate(scheduledAt.getDate() - 1);
      scheduledAt.setHours(17, 0, 0, 0);
    } else {
      scheduledAt = new Date(eventDateTime.getTime() - 5 * 60 * 60 * 1000);
      scheduledAt = addBusinessWindowGuard(scheduledAt);
    }

    const diffMs = nowSp.getTime() - scheduledAt.getTime();
    if (diffMs >= 0 && diffMs <= 90 * 60 * 1000) {
      eligible.push(event.id);
    }
  }

  return eligible;
}
