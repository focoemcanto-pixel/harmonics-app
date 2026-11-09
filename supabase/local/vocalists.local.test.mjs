// Vocalistas pela assistente em Postgres LOCAL descartável (dados 100% sintéticos):
// prioridades Duo/receptivo, eventos simultâneos e próximos, vários casamentos no mesmo dia, pedidos com
// aprovação obrigatória, convites reaproveitados sem disparo, recusa, aceite tardio, conflito no aceite,
// duplicidade, pendências (vocal x operacional) e nenhuma alteração da escala existente.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPgSupabase } from './pg-supabase.mjs';
import {
  planVocalist, eligibleVocalists, createVocalistRequest, decideVocalistRequest, guardInviteResponse, vocalistPendencies,
} from '../../lib/ai/commercial/vocalists.mjs';
import { executeTool } from '../../lib/ai/agent/tools.mjs';

const DB_URL = process.env.LOCAL_DB_URL || 'postgresql://postgres@localhost/harmonics_local?host=/tmp&port=54329';
if (decodeURIComponent(new URL(DB_URL).pathname.slice(1)) !== 'harmonics_local') throw new Error('vocalists.local: use somente o banco descartável harmonics_local.');
const pg = (await import(process.env.PG_MODULE || 'pg')).default;
const pool = new pg.Pool({ connectionString: DB_URL, max: 8 });
const db = createPgSupabase({ pool, role: 'service_role' });
const sql = async (q, p) => (await pool.query(q, p)).rows;

const WS = '00000000-0000-4000-8000-0000000000d7';
const OWNER = '00000000-0000-4000-8000-0000000000d8';
const C = {
  vozM: '00000000-0000-4000-8000-00000000d101', vozF: '00000000-0000-4000-8000-00000000d102', altM: '00000000-0000-4000-8000-00000000d103',
  altF: '00000000-0000-4000-8000-00000000d104', semLink: '00000000-0000-4000-8000-00000000d105', tecl: '00000000-0000-4000-8000-00000000d106',
};
const DATE = '2093-04-18';
const SETTINGS = { arrival_minutes: 120, schedule_buffer_minutes: 60, vocalist_rules: { duo_masculino: C.vozM, duo_feminino: C.vozF, reception_masculino: C.vozM, reception_feminino: C.vozF } };
let E = {};

test.before(async () => {
  await sql('delete from workspaces where id = $1', [WS]);
  await sql("insert into workspaces (id, key, name, slug) values ($1,'ws-voc','Workspace Vocalistas','ws-voc')", [WS]);
  await sql(`insert into contacts (id, workspace_id, name, contact_type) values
    ($1,$7,'Voz Masculina Sintética','musician'), ($2,$7,'Voz Feminina Sintética','musician'), ($3,$7,'Alternativa Masculina','musician'),
    ($4,$7,'Alternativa Feminina','musician'), ($5,$7,'Vocal Sem Link','musician'), ($6,$7,'Tecladista Sintético','musician')`,
  [C.vozM, C.vozF, C.altM, C.altF, C.semLink, C.tecl, WS]);
  await sql(`insert into ai_musician_profiles (workspace_id, contact_id, display_name, roles, is_primary_vocal, voice, client_presentable, presentation_urls) values
    ($1,$2,'Voz Masculina Sintética','{vocal}',true,'masculino',true,'{https://video.example.test/m}'),
    ($1,$3,'Voz Feminina Sintética','{vocal}',false,'feminino',true,'{https://video.example.test/f}'),
    ($1,$4,'Alternativa Masculina','{vocal}',false,'masculino',true,'{https://video.example.test/am}'),
    ($1,$5,'Alternativa Feminina','{vocal}',false,'feminino',true,'{https://video.example.test/af}'),
    ($1,$6,'Vocal Sem Link','{vocal}',false,'masculino',true,'{}')`, [WS, C.vozM, C.vozF, C.altM, C.altF, C.semLink]);
  // Três casamentos no mesmo dia: A (14h, voz masculina já escalada), B (17h, próximo), C (21h, distante).
  const ev = async (name, time, formation, reception = 0) => (await sql(
    "insert into events (workspace_id, client_name, event_date, event_time, duration_min, reception_hours, status, formation) values ($1,$2,$3,$4,60,$5,'confirmado',$6) returning id",
    [WS, name, DATE, time, reception, formation]))[0].id;
  E = { A: await ev('Casamento A', '14:00', 'Trio'), B: await ev('Casamento B', '17:00', 'Duo'), C: await ev('Casamento C', '21:00', 'Duo'), D: await ev('Casamento D', '17:00', 'Quarteto', 2) };
  await sql("insert into event_musicians (event_id, musician_id, role, status) values ($1,$2,'Vocal Masculino','confirmed'), ($1,$3,'Tecladista','confirmed')", [E.A, C.vozM, C.tecl]);
});
test.after(async () => { await pool.end(); });

const escalaSnapshot = async () => sql('select event_id, musician_id, role, status from event_musicians where event_id = any($1) order by event_id, musician_id', [Object.values(E)]);

test('prioridade Duo voz masculina: evento próximo vira conflito (pendência do Owner), distante vira pedido', async () => {
  const near = await planVocalist({ supabase: db, workspaceId: WS, settings: SETTINGS, target: { event_id: E.B, date: DATE, time: '17:00', duration_min: 60, formation: 'Duo', voice: 'masculina' } });
  assert.equal(near.decision, 'conflict', 'A (14h + receptivo 0 + desmontagem + deslocamento) colide com a chegada de B');
  assert.equal(near.contactId, C.vozM, 'nunca substitui automaticamente');
  const far = await planVocalist({ supabase: db, workspaceId: WS, settings: SETTINGS, target: { event_id: E.C, date: DATE, time: '21:00', duration_min: 60, formation: 'Duo', voice: 'masculina' } });
  assert.deepEqual([far.decision, far.reason], ['request', 'priority_duo']);
  const fem = await planVocalist({ supabase: db, workspaceId: WS, settings: SETTINGS, target: { event_id: E.D, date: DATE, time: '17:00', formation: 'Quarteto', reception_hours: 2, voice: 'feminina' } });
  assert.deepEqual([fem.decision, fem.reason, fem.contactId], ['request', 'priority_reception', C.vozF]);
  const owner = await planVocalist({ supabase: db, workspaceId: WS, settings: SETTINGS, target: { event_id: E.D, date: DATE, time: '17:00', formation: 'Trio', voice: 'masculina' } });
  assert.equal(owner.decision, 'owner_decision');
});

test('pedido exige aprovação, é idempotente; aprovar cria convite reaproveitável SEM disparo; concorrência = 1 convite', async () => {
  const target = { event_id: E.C, date: DATE, time: '21:00', duration_min: 60, formation: 'Duo', voice: 'masculina' };
  const r1 = await createVocalistRequest({ supabase: db, workspaceId: WS, target, contactId: C.vozM, reason: 'priority_duo' });
  const r2 = await createVocalistRequest({ supabase: db, workspaceId: WS, target, contactId: C.vozM, reason: 'priority_duo' });
  assert.equal(r1.request.status, 'awaiting_approval');
  assert.equal(r2.duplicate, true);
  assert.equal(r2.request.id, r1.request.id);
  assert.equal((await sql('select count(*)::int n from invites where event_id = $1', [E.C]))[0].n, 0, 'nada criado antes da aprovação');
  assert.equal((await decideVocalistRequest({ supabase: db, workspaceId: WS, requestId: r1.request.id, actor: null, decision: 'approve', settings: SETTINGS })).status, 'actor_required');
  const results = await Promise.all([1, 2, 3].map(() => decideVocalistRequest({ supabase: db, workspaceId: WS, requestId: r1.request.id, actor: OWNER, decision: 'approve', settings: SETTINGS })));
  assert.equal(results.filter((r) => r.ok).length, 1);
  const inv = await sql('select status, whatsapp_sent_at, whatsapp_send_count, suggested_role_name from invites where event_id = $1', [E.C]);
  assert.equal(inv.length, 1);
  assert.deepEqual([inv[0].status, inv[0].whatsapp_sent_at, inv[0].whatsapp_send_count, inv[0].suggested_role_name], ['pending', null, 0, 'Vocal Masculino']);
  const audit = await sql('select action, actor from ai_vocalist_events where request_id = $1 order by created_at', [r1.request.id]);
  assert.deepEqual(audit.map((a) => a.action), ['created', 'approved_invite']);
  assert.equal(audit[1].actor, OWNER);
});

test('conflito só é aprovado com decisão explícita do Owner sobre onde o vocalista fica', async () => {
  const target = { event_id: E.B, date: DATE, time: '17:00', duration_min: 60, formation: 'Duo', voice: 'masculina' };
  const plan = await planVocalist({ supabase: db, workspaceId: WS, settings: SETTINGS, target });
  const { request } = await createVocalistRequest({ supabase: db, workspaceId: WS, target, contactId: plan.contactId, reason: plan.reason, assessment: plan.assessment });
  assert.equal(request.status, 'conflict');
  const blocked = await decideVocalistRequest({ supabase: db, workspaceId: WS, requestId: request.id, actor: OWNER, decision: 'approve', settings: SETTINGS });
  assert.equal(blocked.status, 'conflict');
  assert.equal((await sql('select count(*)::int n from invites where event_id = $1', [E.B]))[0].n, 0);
  const forced = await decideVocalistRequest({ supabase: db, workspaceId: WS, requestId: request.id, actor: OWNER, decision: 'approve', overrideConflict: true, settings: SETTINGS });
  assert.equal(forced.status, 'invite_created');
});

test('alternativas: só autorizados com link, mesma voz, sem conflito nem recusa; nunca "disponível"', async () => {
  const target = { event_id: E.B, date: DATE, time: '17:00', duration_min: 60 };
  const masc = await eligibleVocalists({ supabase: db, workspaceId: WS, settings: SETTINGS, target, voice: 'masculina' });
  assert.deepEqual(masc.map((v) => v.nome), ['Alternativa Masculina'], 'exclui quem tem conflito/convite e quem não tem link');
  assert.equal(masc[0].agenda, 'sem_compromisso_registrado');
  await sql("insert into invites (event_id, contact_id, status) values ($1,$2,'declined')", [E.B, C.altF]);
  const fem = await eligibleVocalists({ supabase: db, workspaceId: WS, settings: SETTINGS, target, voice: 'feminina' });
  assert.deepEqual(fem.map((v) => v.nome), ['Voz Feminina Sintética'], 'quem recusou este evento sai da lista');
});

test('respostas: recusa gera pendência; aceite com conflito novo não confirma; aceite tardio é recusado', async () => {
  const target = { event_id: E.D, date: DATE, time: '17:00', duration_min: 60, formation: 'Quarteto', reception_hours: 2, voice: 'feminina' };
  const { request } = await createVocalistRequest({ supabase: db, workspaceId: WS, target, contactId: C.vozF, reason: 'priority_reception' });
  const ok = await decideVocalistRequest({ supabase: db, workspaceId: WS, requestId: request.id, actor: OWNER, decision: 'approve', settings: SETTINGS });
  // Depois da aprovação, a voz feminina entra em outro evento no mesmo horário (escala real).
  const [{ id: other }] = await sql("insert into events (workspace_id, client_name, event_date, event_time, duration_min, status) values ($1,'Casamento E',$2,'18:00',60,'confirmado') returning id", [WS, DATE]);
  await sql("insert into event_musicians (event_id, musician_id, role, status) values ($1,$2,'Vocal Feminino','confirmed')", [other, C.vozF]);
  const accept = await guardInviteResponse({ supabase: db, inviteId: ok.inviteId, action: 'accept' });
  assert.deepEqual([accept.allow, accept.reason], [false, 'conflict']);
  assert.equal((await sql('select status from ai_vocalist_requests where id = $1', [request.id]))[0].status, 'conflict');
  // Convite comum (não originado pela assistente) segue o fluxo de sempre.
  const [{ id: plain }] = await sql("insert into invites (event_id, contact_id, status) values ($1,$2,'pending') returning id", [E.A, C.tecl]);
  assert.deepEqual(await guardInviteResponse({ supabase: db, inviteId: plain, action: 'accept' }), { allow: true, managed: false });
  // Recusa: pendência de retorno à cliente.
  const t2 = { event_id: E.C, date: DATE, time: '21:00', duration_min: 60, formation: 'Duo', voice: 'feminina' };
  const { request: r2 } = await createVocalistRequest({ supabase: db, workspaceId: WS, target: t2, contactId: C.altF, reason: 'client_choice' });
  const a2 = await decideVocalistRequest({ supabase: db, workspaceId: WS, requestId: r2.id, actor: OWNER, decision: 'approve', settings: SETTINGS });
  assert.equal((await guardInviteResponse({ supabase: db, inviteId: a2.inviteId, action: 'decline' })).allow, true);
  // Aceite tardio: pedido cancelado não confirma.
  await sql("update ai_vocalist_requests set status = 'cancelled' where id = $1", [r2.id]);
  const late = await guardInviteResponse({ supabase: db, inviteId: a2.inviteId, action: 'accept' });
  assert.deepEqual([late.allow, late.reason], [false, 'late']);
  const actions = (await sql('select action from ai_vocalist_events where request_id = $1 order by created_at', [r2.id])).map((x) => x.action);
  assert.deepEqual(actions, ['created', 'approved_invite', 'declined', 'late_response']);
});

test('pendências: sem vocalista, conflito de vocalista, sem resposta; instrumental vai para o operacional', async () => {
  await sql("update ai_vocalist_requests set decided_at = now() - interval '5 days' where workspace_id = $1 and status = 'invite_created'", [WS]);
  const [{ id: semVoz }] = await sql("insert into events (workspace_id, client_name, event_date, event_time, duration_min, status, formation) values ($1,'Casamento F','2093-04-25','16:00',60,'confirmado','Duo') returning id", [WS]);
  const p = await vocalistPendencies({ supabase: db, workspaceId: WS, settings: SETTINGS, now: new Date('2093-04-01T12:00:00Z') });
  const kinds = new Set(p.owner.map((x) => x.kind));
  for (const k of ['vocalist_conflict', 'vocalist_no_response']) assert.ok(kinds.has(k), k);
  assert.ok(p.owner.some((x) => x.kind === 'vocalist_unassigned' && x.event_id === semVoz), 'evento sem vocalista definido');
  assert.ok(!p.owner.some((x) => x.kind === 'vocalist_unassigned' && x.event_id === E.A), 'evento com vocalista escalado não aparece');
  assert.ok(p.operational.every((x) => x.responsible === 'assistente_operacional'));
  assert.ok(p.operational.some((x) => x.event_id === E.A), 'Trio com 1 instrumentista: escala incompleta para o operacional');
});

test('ferramentas da assistente: lista só autorizados e escolha vira pedido (sem confirmar nem enviar)', async () => {
  const conv = { id: '00000000-0000-4000-8000-0000000000d9', workspace_id: WS, lead_data: { data_evento: '2093-05-02', horario: '16:00' } };
  await sql("insert into ai_conversations (id, workspace_id, provider_chat_id) values ($1,$2,'15550009001') on conflict do nothing", [conv.id, WS]);
  const ctx = { supabase: db, workspaceId: WS, conversation: conv, effects: {}, settings: SETTINGS };
  const list = await executeTool('listar_vocalistas', { voz: 'feminina' }, ctx);
  assert.ok(list.vocalistas.every((v) => v.links.length && v.voz === 'feminino'));
  assert.doesNotMatch(JSON.stringify(list.vocalistas), /disponível|sem_compromisso|agenda/i, 'modelo não recebe leitura de agenda dos vocalistas');
  const pick = await executeTool('escolher_vocalista', { nome: 'Alternativa Feminina' }, ctx);
  assert.equal(pick.ok, true);
  const [req] = await sql("select status, reason, target_key from ai_vocalist_requests where conversation_id = $1", [conv.id]);
  assert.deepEqual([req.status, req.reason, req.target_key], ['awaiting_approval', 'client_choice', `conv:${conv.id}`]);
});

test('escala real e contratos existentes não são alterados pela assistente', async () => {
  const snap = await escalaSnapshot();
  assert.ok(snap.some((x) => x.event_id === E.A && x.musician_id === C.vozM && x.status === 'confirmed'), 'escala original intacta');
  assert.equal(snap.filter((x) => x.event_id !== E.A).length, 0, 'nenhuma escala criada pela assistente (só convites pendentes após aprovação)');
});
