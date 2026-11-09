/**
 * Gestão COMERCIAL de vocalistas pela assistente (somente vocalistas; instrumentistas são do assistente
 * operacional). Reaproveita a escala real (events + event_musicians + invites) só para LEITURA e grava
 * apenas pedidos próprios (ai_vocalist_requests) com auditoria (ai_vocalist_events).
 *
 * Regras:
 *  - Prioridade (configurável): Duo com voz masculina/feminina e qualquer formação com receptivo usam o
 *    vocalista definido pelo Owner em ai_workspace_settings.vocalist_rules. Demais casos: decisão do Owner.
 *  - Prioridade NÃO é confirmação: vira pedido aguardando aprovação; escolha da cliente, compromissos
 *    anteriores e decisões do Owner prevalecem.
 *  - Conflito do vocalista prioritário/escolhido: pendência para o Owner decidir; nunca substituição automática.
 *  - Janela ocupada: chegada antecipada + cerimônia + receptivo + desmontagem + deslocamento.
 *  - Sem escala ≠ disponível: a leitura é "sem compromisso registrado".
 *  - Nenhum envio: aprovar cria (ou reaproveita) o convite existente do Harmonics, sem disparo.
 */
export const VOCAL_ROLE = /vocal|voz|cantor|cantora/i;
const CANCELLED_EVENT = new Set(['cancelado', 'cancelada', 'cancelled', 'canceled', 'deleted', 'arquivado', 'archived']);
const DECLINED = new Set(['declined', 'recusado', 'recusou', 'cancelled', 'cancelado', 'removed', 'removido', 'expired', 'expirado']);
const CONFIRMED = new Set(['confirmed', 'confirmado', 'accepted', 'aceito', 'aceitou']);
const ACTIVE_REQUEST = ['awaiting_approval', 'approved_waiting_event', 'invite_created', 'accepted', 'conflict'];
export const CEREMONY_MINUTES = 60;
export const TEARDOWN_MINUTES = 30;

const norm = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null);
const toMinutes = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const hhmm = (m) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`;

/** Voz do vocalista a partir do perfil (campo voice) ou dos papéis cadastrados. */
export function voiceOf(profileOrRole) {
  if (profileOrRole?.voice) return profileOrRole.voice;
  const text = norm([profileOrRole?.role, ...(profileOrRole?.roles || [])].filter(Boolean).join(' '));
  if (/feminin|cantora/.test(text)) return 'feminino';
  if (/masculin|cantor\b/.test(text)) return 'masculino';
  return null;
}
export function normalizeVoice(v) {
  const t = norm(v);
  if (/^fem|mulher|feminin|cantora/.test(t)) return 'feminino';
  if (/^masc|homem|masculin|cantor/.test(t)) return 'masculino';
  return null;
}

/** Janela ocupada (minutos do dia) de um compromisso: chegada + cerimônia + receptivo + desmontagem + deslocamento. */
export function busyWindow(ev, { arrival = 120, travel = 90 } = {}) {
  const start = toMinutes(ev?.event_time ?? ev?.time);
  if (start === null) return null;
  const ceremony = Number(ev?.duration_min ?? ev?.durationMin) || CEREMONY_MINUTES;
  const reception = (Number(ev?.reception_hours ?? ev?.receptionHours) || 0) * 60;
  return { from: start - arrival - travel, to: start + ceremony + reception + TEARDOWN_MINUTES + travel, start, end: start + ceremony + reception };
}
export const overlaps = (a, b) => Boolean(a && b) && a.from < b.to && b.from < a.to;

/** Avalia um vocalista para um alvo, com os compromissos do dia (puro). */
export function assessCommitments({ commitments = [], target, settings = {} }) {
  const opts = { arrival: Number(settings.arrival_minutes ?? 120), travel: Number(settings.schedule_buffer_minutes ?? 90) };
  const mine = busyWindow(target, opts);
  const conflicts = [];
  let review = false;
  let declinedForTarget = false;
  for (const c of commitments) {
    const status = norm(c.status);
    if (target.event_id && c.event_id === target.event_id) { if (DECLINED.has(status)) declinedForTarget = true; continue; }
    if (DECLINED.has(status) || CANCELLED_EVENT.has(norm(c.event_status))) continue;
    const theirs = busyWindow(c, opts);
    if (!mine || !theirs) { review = true; conflicts.push({ event_id: c.event_id, kind: 'sem_horario', status: c.status }); continue; }
    if (!overlaps(mine, theirs)) continue;
    conflicts.push({
      event_id: c.event_id, kind: CONFIRMED.has(status) ? 'confirmado' : 'pendente', status: c.status,
      event_time: hhmm(theirs.start), until: hhmm(theirs.end), source: c.source,
    });
  }
  const hard = conflicts.some((c) => c.kind === 'confirmado' || c.kind === 'pendente');
  return { state: declinedForTarget ? 'declined' : hard ? 'conflict' : review ? 'review' : 'clear', conflicts, declinedForTarget };
}

/** Vocalista prioritário pela regra do Owner (ou null = decisão do Owner). */
export function priorityFor({ formation, receptionHours = 0, voice, rules = {} }) {
  const v = normalizeVoice(voice);
  if (!v) return null;
  if (norm(formation) === 'duo' && rules[`duo_${v}`]) return { contactId: rules[`duo_${v}`], reason: 'priority_duo' };
  if (Number(receptionHours) > 0 && rules[`reception_${v}`]) return { contactId: rules[`reception_${v}`], reason: 'priority_reception' };
  return null;
}

/** Compromissos reais do dia por contato (escala, convites e pedidos de vocalista ativos). */
export async function loadDayCommitments({ supabase, workspaceId, date }) {
  const { data: events } = await supabase.from('events')
    .select('id, event_date, event_time, duration_min, reception_hours, status, location_name, client_name')
    .eq('workspace_id', workspaceId).eq('event_date', date);
  const evs = (events || []).filter((e) => !CANCELLED_EVENT.has(norm(e.status)));
  const ids = evs.map((e) => e.id);
  const [links, invites, requests] = await Promise.all([
    ids.length ? supabase.from('event_musicians').select('event_id, musician_id, role, status, is_active').in('event_id', ids) : { data: [] },
    ids.length ? supabase.from('invites').select('id, event_id, contact_id, status, suggested_role_name').in('event_id', ids) : { data: [] },
    supabase.from('ai_vocalist_requests').select('*').eq('workspace_id', workspaceId).eq('event_date', date).in('status', ACTIVE_REQUEST),
  ]);
  const byEvent = new Map(evs.map((e) => [e.id, e]));
  const byContact = new Map();
  const add = (contactId, row) => { if (!contactId) return; if (!byContact.has(contactId)) byContact.set(contactId, []); byContact.get(contactId).push(row); };
  for (const l of links.data || []) {
    if (l.is_active === false) continue;
    const e = byEvent.get(l.event_id); if (!e) continue;
    add(l.musician_id, { ...e, event_id: e.id, event_status: e.status, status: l.status || 'confirmed', role: l.role, source: 'escala' });
  }
  for (const i of invites.data || []) {
    const e = byEvent.get(i.event_id); if (!e) continue;
    if ((byContact.get(i.contact_id) || []).some((c) => c.event_id === e.id && c.source === 'escala')) continue;
    add(i.contact_id, { ...e, event_id: e.id, event_status: e.status, status: i.status || 'pending', role: i.suggested_role_name, source: 'convite' });
  }
  for (const r of requests.data || []) {
    if (r.event_id && (byContact.get(r.contact_id) || []).some((c) => c.event_id === r.event_id)) continue;
    add(r.contact_id, { event_id: r.event_id || r.target_key, event_time: r.start_time, duration_min: r.duration_min, reception_hours: r.reception_hours, status: r.status === 'accepted' ? 'accepted' : 'pending', source: 'pedido' });
  }
  return { events: evs, byContact };
}

export function targetKey(t) {
  if (t.event_id) return `event:${t.event_id}`;
  if (t.precontract_id) return `pc:${t.precontract_id}`;
  return `conv:${t.conversation_id}`;
}

/** Decide o próximo passo para o vocalista de um alvo (não grava nada). */
export async function planVocalist({ supabase, workspaceId, settings = {}, target, chosenContactId = null }) {
  const pick = chosenContactId ? { contactId: chosenContactId, reason: 'client_choice' }
    : priorityFor({ formation: target.formation, receptionHours: target.reception_hours, voice: target.voice, rules: settings.vocalist_rules || {} });
  if (!pick) return { decision: 'owner_decision', reason: 'no_priority_rule' };
  const { byContact } = await loadDayCommitments({ supabase, workspaceId, date: target.date });
  const assessment = assessCommitments({ commitments: byContact.get(pick.contactId) || [], target, settings });
  if (assessment.state === 'declined') return { decision: 'owner_decision', reason: 'declined_for_event', contactId: pick.contactId, assessment };
  if (assessment.state === 'conflict') return { decision: 'conflict', contactId: pick.contactId, reason: pick.reason, assessment };
  return { decision: 'request', contactId: pick.contactId, reason: pick.reason, assessment };
}

/** Alternativas elegíveis para apresentar à cliente (só autorizados, com links, sem conflito nem recusa). */
export async function eligibleVocalists({ supabase, workspaceId, settings = {}, target, voice = null }) {
  const { data: profiles } = await supabase.from('ai_musician_profiles').select('*').eq('workspace_id', workspaceId).eq('active', true);
  const wanted = normalizeVoice(voice);
  const candidates = (profiles || []).filter((p) => p.client_presentable === true && (p.presentation_urls || []).length
    && (VOCAL_ROLE.test((p.roles || []).join(' ')) || p.voice) && (!wanted || voiceOf(p) === wanted));
  if (!candidates.length) return [];
  const { byContact } = target?.date ? await loadDayCommitments({ supabase, workspaceId, date: target.date }) : { byContact: new Map() };
  const out = [];
  for (const p of candidates) {
    const a = target?.date ? assessCommitments({ commitments: byContact.get(p.contact_id) || [], target, settings }) : { state: 'review', conflicts: [] };
    if (a.state === 'conflict' || a.state === 'declined') continue;
    out.push({ contact_id: p.contact_id, nome: p.display_name, voz: voiceOf(p), links: (p.presentation_urls || []).slice(0, 3), agenda: a.state === 'clear' ? 'sem_compromisso_registrado' : 'a_confirmar' });
  }
  return out;
}

async function audit(supabase, workspaceId, requestId, action, actor, details = {}) {
  await supabase.from('ai_vocalist_events').insert({ workspace_id: workspaceId, request_id: requestId, action, actor: String(actor || 'ai'), details });
}

/** Cria pedido (consulta/convite) aguardando aprovação do Owner — idempotente por alvo + vocalista. */
export async function createVocalistRequest({ supabase, workspaceId, target, contactId, reason, assessment = null, actor = 'ai' }) {
  const key = targetKey(target);
  const { data: existing } = await supabase.from('ai_vocalist_requests').select('*')
    .eq('workspace_id', workspaceId).eq('target_key', key).eq('contact_id', contactId).in('status', ACTIVE_REQUEST).maybeSingle();
  if (existing) return { request: existing, duplicate: true };
  const row = {
    workspace_id: workspaceId, conversation_id: target.conversation_id || null, event_id: target.event_id || null,
    precontract_id: target.precontract_id || null, target_key: key, contact_id: contactId, voice: normalizeVoice(target.voice),
    reason, status: assessment?.state === 'conflict' ? 'conflict' : 'awaiting_approval', event_date: target.date,
    start_time: target.time || null, duration_min: target.duration_min || CEREMONY_MINUTES, reception_hours: Number(target.reception_hours) || 0,
    formation: target.formation || null, location: target.location || null, conflicts: assessment?.conflicts || [], created_by: String(actor),
  };
  const { data, error } = await supabase.from('ai_vocalist_requests').insert(row).select('*').single();
  if (error) {
    const { data: again } = await supabase.from('ai_vocalist_requests').select('*')
      .eq('workspace_id', workspaceId).eq('target_key', key).eq('contact_id', contactId).in('status', ACTIVE_REQUEST).maybeSingle();
    if (again) return { request: again, duplicate: true };
    return { error };
  }
  await audit(supabase, workspaceId, data.id, 'created', actor, { reason, status: data.status, conflicts: row.conflicts });
  return { request: data, duplicate: false };
}

const ROLE_NAME = { masculino: 'Vocal Masculino', feminino: 'Vocal Feminino' };

/**
 * Decisão EXPLÍCITA do Owner. Aprovar revalida a escala; com evento, cria/reaproveita o convite existente
 * (status pending, SEM disparo). Conflito só é aprovado com override_conflict (o Owner decide onde fica).
 */
export async function decideVocalistRequest({ supabase, workspaceId, requestId, actor, decision, overrideConflict = false, note = null, settings = {} }) {
  if (!actor) return { ok: false, status: 'actor_required' };
  const { data: req } = await supabase.from('ai_vocalist_requests').select('*').eq('id', requestId).eq('workspace_id', workspaceId).maybeSingle();
  if (!req) return { ok: false, status: 'not_found' };
  if (!['awaiting_approval', 'conflict', 'approved_waiting_event'].includes(req.status)) return { ok: false, status: 'already_decided', current: req.status };
  const now = new Date().toISOString();
  if (decision === 'reject') {
    const { data: moved } = await supabase.from('ai_vocalist_requests').update({ status: 'rejected', decided_by: actor, decided_at: now, notes: note, updated_at: now })
      .eq('id', req.id).eq('status', req.status).select('id').maybeSingle();
    if (!moved) return { ok: false, status: 'already_decided' };
    await audit(supabase, workspaceId, req.id, 'rejected', actor, { note });
    return { ok: true, status: 'rejected' };
  }
  if (decision !== 'approve') return { ok: false, status: 'invalid_decision' };
  const target = { event_id: req.event_id, date: day(req.event_date), time: req.start_time, duration_min: req.duration_min, reception_hours: req.reception_hours };
  const { byContact } = await loadDayCommitments({ supabase, workspaceId, date: target.date });
  const commitments = (byContact.get(req.contact_id) || []).filter((c) => c.event_id !== req.event_id && c.event_id !== req.target_key);
  const a = assessCommitments({ commitments, target, settings });
  if (a.state === 'conflict' && !overrideConflict) {
    await supabase.from('ai_vocalist_requests').update({ status: 'conflict', conflicts: a.conflicts, updated_at: now }).eq('id', req.id);
    await audit(supabase, workspaceId, req.id, 'approval_blocked_conflict', actor, { conflicts: a.conflicts });
    return { ok: false, status: 'conflict', conflicts: a.conflicts };
  }
  if (!req.event_id) {
    const { data: moved } = await supabase.from('ai_vocalist_requests').update({ status: 'approved_waiting_event', decided_by: actor, decided_at: now, updated_at: now })
      .eq('id', req.id).eq('status', req.status).select('id').maybeSingle();
    if (!moved) return { ok: false, status: 'already_decided' };
    await audit(supabase, workspaceId, req.id, 'approved_waiting_event', actor, { override_conflict: overrideConflict });
    return { ok: true, status: 'approved_waiting_event' };
  }
  // Reserva o pedido antes de criar o convite (duas aprovações simultâneas criam um único convite).
  const { data: claimed } = await supabase.from('ai_vocalist_requests').update({ status: 'invite_created', decided_by: actor, decided_at: now, updated_at: now })
    .eq('id', req.id).eq('status', req.status).select('id').maybeSingle();
  if (!claimed) return { ok: false, status: 'already_decided' };
  const { data: invites } = await supabase.from('invites').select('id, status').eq('event_id', req.event_id).eq('contact_id', req.contact_id);
  let invite = (invites || []).find((i) => !DECLINED.has(norm(i.status)));
  let reused = Boolean(invite);
  if (!invite) {
    const { data: created, error } = await supabase.from('invites')
      .insert({ event_id: req.event_id, contact_id: req.contact_id, suggested_role_name: ROLE_NAME[req.voice] || 'Vocal', status: 'pending' })
      .select('id, status').single();
    if (error || !created) {
      await supabase.from('ai_vocalist_requests').update({ status: req.status, decided_by: null, decided_at: null, updated_at: now }).eq('id', req.id);
      return { ok: false, status: 'invite_failed' };
    }
    invite = created; reused = false;
  }
  await supabase.from('ai_vocalist_requests').update({ invite_id: invite.id, updated_at: now }).eq('id', req.id);
  // Outros pedidos ativos do mesmo alvo e voz deixam de valer.
  const { data: others } = await supabase.from('ai_vocalist_requests').select('id, voice').eq('workspace_id', workspaceId).eq('target_key', req.target_key).in('status', ['awaiting_approval', 'conflict']);
  for (const o of (others || []).filter((x) => x.id !== req.id && (!req.voice || x.voice === req.voice))) {
    await supabase.from('ai_vocalist_requests').update({ status: 'superseded', updated_at: now }).eq('id', o.id).in('status', ['awaiting_approval', 'conflict']);
    await audit(supabase, workspaceId, o.id, 'superseded', actor, { by: req.id });
  }
  await audit(supabase, workspaceId, req.id, 'approved_invite', actor, { invite_id: invite.id, reused, override_conflict: overrideConflict, dispatched: false });
  return { ok: true, status: 'invite_created', inviteId: invite.id, reused, dispatched: false };
}

/**
 * Antes de o painel do membro gravar a resposta na escala: convites originados pela assistente são
 * revalidados (aceite com conflito ou resposta tardia não confirma). Convites comuns seguem como antes.
 */
export async function guardInviteResponse({ supabase, inviteId, action, settings = null }) {
  const { data: req } = await supabase.from('ai_vocalist_requests').select('*').eq('invite_id', inviteId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!req) return { allow: true, managed: false };
  if (!settings) {
    const { data } = await supabase.from('ai_workspace_settings').select('arrival_minutes, schedule_buffer_minutes').eq('workspace_id', req.workspace_id).maybeSingle();
    settings = data || {};
  }
  const now = new Date().toISOString();
  if (['cancelled', 'superseded', 'rejected', 'expired'].includes(req.status)) {
    await audit(supabase, req.workspace_id, req.id, 'late_response', `invite:${inviteId}`, { action, request_status: req.status });
    return { allow: false, managed: true, reason: 'late', message: 'Este convite não está mais ativo. A equipe vai entrar em contato.' };
  }
  if (action === 'decline') {
    await supabase.from('ai_vocalist_requests').update({ status: 'declined', responded_at: now, updated_at: now }).eq('id', req.id).in('status', ['invite_created', 'accepted', 'conflict']);
    await audit(supabase, req.workspace_id, req.id, 'declined', `invite:${inviteId}`, {});
    return { allow: true, managed: true };
  }
  const target = { event_id: req.event_id, date: day(req.event_date), time: req.start_time, duration_min: req.duration_min, reception_hours: req.reception_hours };
  const { byContact } = await loadDayCommitments({ supabase, workspaceId: req.workspace_id, date: target.date });
  const commitments = (byContact.get(req.contact_id) || []).filter((c) => c.event_id !== req.event_id && c.event_id !== req.target_key);
  const a = assessCommitments({ commitments, target, settings });
  if (a.state === 'conflict') {
    await supabase.from('ai_vocalist_requests').update({ status: 'conflict', conflicts: a.conflicts, responded_at: now, updated_at: now }).eq('id', req.id);
    await audit(supabase, req.workspace_id, req.id, 'accept_blocked_conflict', `invite:${inviteId}`, { conflicts: a.conflicts });
    return { allow: false, managed: true, reason: 'conflict', message: 'Recebemos seu aceite, mas há um compromisso no mesmo horário. A equipe vai confirmar com você.' };
  }
  await supabase.from('ai_vocalist_requests').update({ status: 'accepted', responded_at: now, updated_at: now }).eq('id', req.id).eq('status', 'invite_created');
  await audit(supabase, req.workspace_id, req.id, 'accepted', `invite:${inviteId}`, {});
  return { allow: true, managed: true };
}

/** Pendências de vocalistas (Owner) e, à parte, escalas instrumentais incompletas (assistente operacional). */
export async function vocalistPendencies({ supabase, workspaceId, settings = {}, now = new Date(), horizonDays = 180 }) {
  const today = now.toISOString().slice(0, 10);
  const until = new Date(now.getTime() + horizonDays * 86400000).toISOString().slice(0, 10);
  const { data: events } = await supabase.from('events')
    .select('id, event_date, event_time, duration_min, reception_hours, status, formation, client_name, location_name')
    .eq('workspace_id', workspaceId).gte('event_date', today).lte('event_date', until);
  const evs = (events || []).filter((e) => !CANCELLED_EVENT.has(norm(e.status)));
  const ids = evs.map((e) => e.id);
  const [links, requests, profiles] = await Promise.all([
    ids.length ? supabase.from('event_musicians').select('event_id, musician_id, role, status, is_active').in('event_id', ids) : { data: [] },
    supabase.from('ai_vocalist_requests').select('*').eq('workspace_id', workspaceId).gte('event_date', today),
    supabase.from('ai_musician_profiles').select('contact_id, display_name, is_primary_vocal').eq('workspace_id', workspaceId),
  ]);
  const names = new Map((profiles.data || []).map((p) => [p.contact_id, p.display_name]));
  const active = (links.data || []).filter((l) => l.is_active !== false && !DECLINED.has(norm(l.status)));
  const reqs = requests.data || [];
  const out = { owner: [], operational: [] };
  const SIZE = { solo: 1, duo: 2, trio: 3, quarteto: 4, quinteto: 5, sexteto: 6, septeto: 7 };
  for (const e of evs) {
    const crew = active.filter((l) => l.event_id === e.id);
    const vocals = crew.filter((l) => VOCAL_ROLE.test(l.role || ''));
    const pendingReq = reqs.some((r) => r.event_id === e.id && ACTIVE_REQUEST.includes(r.status));
    if (!vocals.length && !pendingReq) out.owner.push({ kind: 'vocalist_unassigned', event_id: e.id, date: day(e.event_date), time: e.event_time, client: e.client_name, decision: 'Definir o vocalista do evento.' });
    const size = SIZE[norm(e.formation).split(/\s/)[0]] || 0;
    const instrumental = crew.length - vocals.length;
    if (size && instrumental < size - (vocals.length ? vocals.length : 1)) {
      out.operational.push({ kind: 'escala_incompleta', event_id: e.id, date: day(e.event_date), responsible: 'assistente_operacional', detail: `${instrumental} instrumentista(s) escalado(s) para ${e.formation}.` });
    }
  }
  // Vocalistas em eventos simultâneos/próximos.
  const opts = { arrival: Number(settings.arrival_minutes ?? 120), travel: Number(settings.schedule_buffer_minutes ?? 90) };
  const byVocal = new Map();
  for (const l of active.filter((x) => VOCAL_ROLE.test(x.role || ''))) {
    const e = evs.find((x) => x.id === l.event_id); if (!e) continue;
    if (!byVocal.has(l.musician_id)) byVocal.set(l.musician_id, []);
    byVocal.get(l.musician_id).push(e);
  }
  for (const [contactId, list] of byVocal) {
    for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i]; const b = list[j];
      if (day(a.event_date) !== day(b.event_date)) continue;
      const wa = busyWindow(a, opts); const wb = busyWindow(b, opts);
      if (!wa || !wb || overlaps(wa, wb)) {
        out.owner.push({ kind: 'vocalist_conflict', contact_id: contactId, vocalist: names.get(contactId) || null, date: day(a.event_date), events: [a.id, b.id], decision: 'Decidir em qual evento o vocalista fica (sem substituição automática).' });
      }
    }
  }
  const responseDays = Number(settings.invite_response_days ?? 3);
  for (const r of reqs) {
    if (r.status === 'awaiting_approval') out.owner.push({ kind: 'vocalist_invite', request_id: r.id, contact_id: r.contact_id, vocalist: names.get(r.contact_id) || null, date: day(r.event_date), reason: r.reason, decision: 'Aprovar ou recusar a consulta/convite.' });
    if (r.status === 'conflict') out.owner.push({ kind: 'vocalist_conflict', request_id: r.id, contact_id: r.contact_id, vocalist: names.get(r.contact_id) || null, date: day(r.event_date), conflicts: r.conflicts, decision: 'Decidir em qual evento o vocalista fica.' });
    if (r.status === 'declined') out.owner.push({ kind: 'vocalist_declined', request_id: r.id, vocalist: names.get(r.contact_id) || null, date: day(r.event_date), decision: 'Retornar à cliente com novas opções.' });
    if (r.status === 'invite_created' && r.decided_at && now.getTime() - new Date(r.decided_at).getTime() > responseDays * 86400000) {
      out.owner.push({ kind: 'vocalist_no_response', request_id: r.id, vocalist: names.get(r.contact_id) || null, date: day(r.event_date), decision: 'Convite sem resposta: cobrar ou escolher outra opção.' });
    }
  }
  return out;
}
