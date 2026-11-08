/**
 * Disponibilidade de músicos a partir da escala real do Harmonics
 * (events + event_musicians + invites). Três resultados possíveis:
 *  - available: nenhum compromisso conflitante registrado;
 *  - conflict: conflito REAL confirmado (horários conhecidos que se sobrepõem, com margem
 *    de deslocamento, em compromisso confirmado);
 *  - review: agenda inconclusiva (sem horário, convite pendente, dados faltando) ⇒ revisão
 *    humana, sem anunciar indisponibilidade ao cliente.
 */
const CANCELLED = new Set(['cancelado', 'cancelada', 'cancelled', 'canceled']);
const DECLINED = new Set(['declined', 'recusado', 'recusou', 'cancelled', 'cancelado', 'removed', 'removido']);
const CONFIRMED = new Set(['confirmed', 'confirmado', 'accepted', 'aceito', 'aceitou']);

function isoDay(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  return value ? String(value).slice(0, 10) : null;
}

function toMinutes(time) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(time || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * Puro. bookings: [{ event_date, event_time, duration_min, status, event_status }]
 * request: { date, time, durationMin, bufferMin }
 */
export function evaluateAvailability(bookings = [], request = {}) {
  const sameDay = bookings.filter((b) => isoDay(b.event_date) === isoDay(request.date) && !CANCELLED.has(String(b.event_status || '').toLowerCase()));
  const active = sameDay.filter((b) => !DECLINED.has(String(b.status || '').toLowerCase()));
  if (!active.length) return { status: 'available', reasons: [] };

  const reqStart = toMinutes(request.time);
  const reqDuration = Number(request.durationMin) || 0;
  const buffer = Number(request.bufferMin) || 0;
  const reasons = [];
  let conflict = false;
  let inconclusive = false;

  for (const b of active) {
    const start = toMinutes(b.event_time);
    const duration = Number(b.duration_min) || 0;
    const confirmed = CONFIRMED.has(String(b.status || '').toLowerCase());
    if (reqStart === null || start === null || !duration || !reqDuration) {
      inconclusive = true; reasons.push('missing_time_or_duration'); continue;
    }
    const overlaps = reqStart < start + duration + buffer && start < reqStart + reqDuration + buffer;
    if (!overlaps) continue;
    if (confirmed) { conflict = true; reasons.push('confirmed_overlap'); }
    else { inconclusive = true; reasons.push('unconfirmed_overlap'); }
  }
  if (conflict) return { status: 'conflict', reasons };
  if (inconclusive) return { status: 'review', reasons };
  return { status: 'available', reasons: ['same_day_no_overlap'] };
}

/** Compromissos do músico (contato) na data, no workspace. */
export async function loadBookings({ supabase, workspaceId, contactId, date }) {
  const { data: events, error } = await supabase.from('events')
    .select('id, event_date, event_time, duration_min, status')
    .eq('workspace_id', workspaceId).eq('event_date', date);
  if (error) return { error };
  if (!events?.length) return { bookings: [] };
  const ids = events.map((e) => e.id);
  const [{ data: links, error: e1 }, { data: invites, error: e2 }] = await Promise.all([
    supabase.from('event_musicians').select('event_id, musician_id, status, is_active').in('event_id', ids).eq('musician_id', contactId),
    supabase.from('invites').select('event_id, contact_id, status').in('event_id', ids).eq('contact_id', contactId),
  ]);
  if (e1 || e2) return { error: e1 || e2 };
  const byId = new Map(events.map((e) => [e.id, e]));
  const bookings = [];
  for (const link of links || []) {
    if (link.is_active === false) continue;
    const ev = byId.get(link.event_id);
    bookings.push({ ...ev, event_status: ev.status, status: link.status || 'confirmed' });
  }
  for (const inv of invites || []) {
    if (bookings.some((b) => b.id === inv.event_id)) continue;
    const ev = byId.get(inv.event_id);
    bookings.push({ ...ev, event_status: ev.status, status: inv.status || 'pending' });
  }
  return { bookings };
}

export async function checkMusician({ supabase, workspaceId, profile, request }) {
  const { bookings, error } = await loadBookings({ supabase, workspaceId, contactId: profile.contact_id, date: request.date });
  if (error) return { status: 'review', reasons: ['schedule_unavailable'] };
  return evaluateAvailability(bookings, request);
}

/**
 * Vocalista principal (consultado silenciosamente). Em conflito real, devolve substitutos
 * de voz COM disponibilidade verificada e vídeos. Inconclusivo => review.
 */
export async function checkPrimaryVocal({ supabase, workspaceId, request }) {
  const { data: profiles } = await supabase.from('ai_musician_profiles').select('*')
    .eq('workspace_id', workspaceId).eq('active', true);
  const all = profiles || [];
  const primary = all.find((p) => p.is_primary_vocal);
  if (!primary) return { status: 'review', reasons: ['primary_vocal_not_configured'], substitutes: [] };
  const result = await checkMusician({ supabase, workspaceId, profile: primary, request });
  if (result.status !== 'conflict') return { ...result, primary: { id: primary.id, name: primary.display_name }, substitutes: [] };
  const vocals = all.filter((p) => !p.is_primary_vocal && (p.roles || []).some((r) => /vocal|voz/i.test(r)));
  const substitutes = [];
  for (const v of vocals) {
    const r = await checkMusician({ supabase, workspaceId, profile: v, request });
    if (r.status === 'available') substitutes.push({ id: v.id, name: v.display_name, videos: (v.video_urls || []).slice(0, 2), portfolio: v.portfolio_url || null });
  }
  return { status: 'conflict', reasons: result.reasons, primary: { id: primary.id, name: primary.display_name }, substitutes };
}
