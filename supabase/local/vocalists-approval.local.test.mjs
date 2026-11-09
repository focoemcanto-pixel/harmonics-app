// Aprovação ESPECÍFICA de convites de vocalista, revalidação antes de qualquer disparo e respostas pelo painel do
// membro (rota real). Postgres LOCAL descartável, dados 100% sintéticos (nomes, datas e locais inventados).
// Rodar: ./supabase/local/run-ai-inbox.sh (usa --import ./supabase/local/panel/register.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getSupabaseAdmin, panelPool as pool } from './panel/supabase-admin.stub.mjs';
import {
  createVocalistRequest, decideVocalistRequest, guardInviteDispatch, vocalistPendencies,
} from '../../lib/ai/commercial/vocalists.mjs';
import { sendInviteService } from '../../lib/whatsapp/send-invite-service.js';
import { POST as memberRespond } from '../../app/api/member/invites/[inviteId]/respond/route.js';

const db = getSupabaseAdmin();
const sql = async (q, p) => (await pool.query(q, p)).rows;

const WS = '00000000-0000-4000-8000-0000000000e7';
const OWNER = '00000000-0000-4000-8000-0000000000e8';
const C = { vozM: '00000000-0000-4000-8000-00000000e101', vozF: '00000000-0000-4000-8000-00000000e102', comum: '00000000-0000-4000-8000-00000000e103' };
const DATE = '2094-05-20';
const DATE_ACEITE = '2094-05-27';
const SETTINGS = { arrival_minutes: 120, schedule_buffer_minutes: 60 };
const E = {};
let baseline;

// Sessão do membro: o cliente local não tem Auth; o token sintético vira o e-mail do contato.
db.auth = { getUser: async (token) => ({ data: { user: { id: `user-${token}`, email: `${token}@example.test` } }, error: null }) };

const messageCounts = async () => (await sql(`select
  (select count(*)::int from ai_message_outbox where workspace_id = $1) outbox,
  (select count(*)::int from ai_messages where workspace_id = $1) messages,
  (select count(*)::int from automation_logs where workspace_id = $1) automations,
  (select count(*)::int from invites i join events e on e.id = i.event_id where e.workspace_id = $1 and (i.whatsapp_sent_at is not null or i.whatsapp_send_count > 0)) sent`, [WS]))[0];

test.before(async () => {
  await sql('delete from workspaces where id = $1', [WS]);
  await sql('delete from contacts where id = any($1)', [Object.values(C)]);
  await sql("insert into workspaces (id, key, name, slug) values ($1,'ws-voc-ap','Workspace Aprovação Vocal','ws-voc-ap')", [WS]);
  await sql(`insert into contacts (id, workspace_id, name, contact_type, email) values
    ($1,$4,'Voz Masculina Teste','musician','voz.m@example.test'), ($2,$4,'Voz Feminina Teste','musician','voz.f@example.test'),
    ($3,$4,'Instrumentista Teste','musician','comum@example.test')`, [C.vozM, C.vozF, C.comum, WS]);
  const ev = async (name, time, formation, location, date = DATE) => (await sql(
    "insert into events (workspace_id, client_name, event_date, event_time, duration_min, reception_hours, status, formation, location_name) values ($1,$2,$3,$4,60,0,'confirmado',$5,$6) returning id",
    [WS, name, date, time, formation, location]))[0].id;
  E.mudaHora = await ev('Evento Teste 1', '10:00', 'Duo', 'Capela Inventada');
  E.mudaLocal = await ev('Evento Teste 2', '10:00', 'Duo', 'Capela Inventada');
  E.cancela = await ev('Evento Teste 3', '20:00', 'Duo', 'Salão Inventado');
  E.recusa = await ev('Evento Teste 4', '10:00', 'Duo', 'Jardim Inventado');
  E.aceite = await ev('Evento Teste 5', '20:00', 'Duo', 'Jardim Inventado', DATE_ACEITE);
  baseline = await messageCounts();
});
test.after(async () => { await pool.end(); });

const target = (eventId, time, location, voice = 'masculino', date = DATE) => ({ event_id: eventId, date, time, duration_min: 60, formation: 'Duo', location, voice });
async function approved(eventId, time, location, contactId, voice, date = DATE) {
  const { request } = await createVocalistRequest({ supabase: db, workspaceId: WS, target: target(eventId, time, location, voice, date), contactId, reason: 'priority_duo' });
  const r = await decideVocalistRequest({ supabase: db, workspaceId: WS, requestId: request.id, actor: OWNER, decision: 'approve', settings: SETTINGS });
  assert.equal(r.status, 'invite_created');
  return { request, inviteId: r.inviteId };
}

test('aprovação é específica (músico, evento, data, horário, duração, formação, local) e é revalidada antes do disparo', async () => {
  const { request, inviteId } = await approved(E.mudaHora, '10:00', 'Capela Inventada', C.vozM, 'masculino');
  const [row] = await sql('select approved_snapshot from ai_vocalist_requests where id = $1', [request.id]);
  assert.deepEqual(
    (({ contact_id, event_id, date, time, duration_min, formation, location, approved_by }) => ({ contact_id, event_id, date, time, duration_min, formation, location, approved_by }))(row.approved_snapshot),
    { contact_id: C.vozM, event_id: E.mudaHora, date: DATE, time: '10:00', duration_min: 60, formation: 'duo', location: 'capela inventada', approved_by: OWNER },
  );
  assert.equal((await guardInviteDispatch({ supabase: db, inviteId, settings: SETTINGS })).allow, true, 'nada mudou: pode seguir (envio continua manual)');

  // Mudança relevante depois da aprovação => bloqueia o disparo e pede NOVA aprovação.
  await sql("update events set event_time = '15:00' where id = $1", [E.mudaHora]);
  const blocked = await guardInviteDispatch({ supabase: db, inviteId, settings: SETTINGS });
  assert.deepEqual([blocked.allow, blocked.reason, blocked.drift], [false, 'changed', ['time']]);
  const reqs = await sql('select id, status, start_time::text, replaces_request_id, invite_id from ai_vocalist_requests where event_id = $1 order by created_at', [E.mudaHora]);
  assert.deepEqual(reqs.map((r) => r.status), ['superseded', 'awaiting_approval']);
  assert.equal(reqs[1].start_time.slice(0, 5), '15:00', 'novo pedido usa os dados atuais do evento');
  assert.equal(reqs[1].replaces_request_id, request.id);
  assert.equal((await guardInviteDispatch({ supabase: db, inviteId, settings: SETTINGS })).reason, 'not_approved', 'sem nova aprovação, segue bloqueado');

  // O serviço real de envio recusa antes de tocar no provedor.
  const send = await sendInviteService({ inviteId, supabaseAdmin: db });
  assert.deepEqual([send.ok, send.status, send.data.requiresApproval, send.data.code], [false, 409, true, 'not_approved']);

  // Nova aprovação explícita reaproveita o MESMO convite e libera.
  const again = await decideVocalistRequest({ supabase: db, workspaceId: WS, requestId: reqs[1].id, actor: OWNER, decision: 'approve', settings: SETTINGS });
  assert.deepEqual([again.status, again.reused, again.inviteId], ['invite_created', true, inviteId]);
  assert.equal((await guardInviteDispatch({ supabase: db, inviteId, settings: SETTINGS })).allow, true);
  assert.equal((await sql('select count(*)::int n from invites where event_id = $1', [E.mudaHora]))[0].n, 1, 'sem convite duplicado');
});

test('mudança entre o pedido e a aprovação: aprovar não cria convite e gera novo pedido', async () => {
  const { request } = await createVocalistRequest({ supabase: db, workspaceId: WS, target: target(E.mudaLocal, '10:00', 'Capela Inventada'), contactId: C.vozM, reason: 'client_choice' });
  await sql("update events set location_name = 'Outra Capela Inventada' where id = $1", [E.mudaLocal]);
  const r = await decideVocalistRequest({ supabase: db, workspaceId: WS, requestId: request.id, actor: OWNER, decision: 'approve', settings: SETTINGS });
  assert.deepEqual([r.ok, r.status, r.drift], [false, 'changed', ['location']]);
  assert.equal((await sql('select count(*)::int n from invites where event_id = $1', [E.mudaLocal]))[0].n, 0);
  const [fresh] = await sql("select location, reason from ai_vocalist_requests where event_id = $1 and status = 'awaiting_approval'", [E.mudaLocal]);
  assert.deepEqual([fresh.location, fresh.reason], ['Outra Capela Inventada', 'client_choice']);
});

test('evento cancelado encerra o pedido e bloqueia o disparo; convite comum não é afetado', async () => {
  const { request, inviteId } = await approved(E.cancela, '20:00', 'Salão Inventado', C.vozF, 'feminino');
  await sql("update events set status = 'cancelado' where id = $1", [E.cancela]);
  const g = await guardInviteDispatch({ supabase: db, inviteId, settings: SETTINGS });
  assert.equal(g.allow, false);
  assert.equal((await sql('select status from ai_vocalist_requests where id = $1', [request.id]))[0].status, 'cancelled');
  assert.equal((await sql("select count(*)::int n from ai_vocalist_requests where event_id = $1 and status = 'awaiting_approval'", [E.cancela]))[0].n, 0);

  const [plain] = await sql("insert into invites (event_id, contact_id, suggested_role_name, status) values ($1,$2,'Teclado','pending') returning id", [E.recusa, C.comum]);
  assert.deepEqual(await guardInviteDispatch({ supabase: db, inviteId: plain.id }), { allow: true, managed: false });
});

const respond = (inviteId, action, token) => memberRespond(
  new Request(`http://local/api/member/invites/${inviteId}/respond`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ action }) }),
  { params: Promise.resolve({ inviteId }) },
);

test('painel do membro: recusa atualiza pedido e pendências, sem mensagem automática à noiva', async () => {
  const { request, inviteId } = await approved(E.recusa, '10:00', 'Jardim Inventado', C.vozF, 'feminino');
  const res = await respond(inviteId, 'decline', 'voz.f');
  assert.equal(res.status, 200, await res.clone().text());
  assert.equal((await sql('select status from invites where id = $1', [inviteId]))[0].status, 'declined');
  assert.equal((await sql('select status from ai_vocalist_requests where id = $1', [request.id]))[0].status, 'declined');
  const p = await vocalistPendencies({ supabase: db, workspaceId: WS, settings: SETTINGS, now: new Date('2094-05-01T12:00:00Z') });
  assert.ok(p.owner.some((x) => x.kind === 'vocalist_declined' && x.request_id === request.id), 'Owner decide o retorno à cliente');
  assert.ok(p.owner.some((x) => x.kind === 'vocalist_unassigned' && x.event_id === E.recusa), 'evento volta a ficar sem vocalista');
  assert.ok(!p.operational.some((x) => x.event_id === E.recusa && /vocal/i.test(x.detail)), 'vocal não vai para o operacional');
  assert.deepEqual(await messageCounts(), baseline, 'nenhuma mensagem/automação para a noiva e nenhum disparo');
});

test('painel do membro: aceite confirma na escala e limpa as pendências do evento, sem mensagem automática', async () => {
  const { request, inviteId } = await approved(E.aceite, '20:00', 'Jardim Inventado', C.vozM, 'masculino', DATE_ACEITE);
  let p = await vocalistPendencies({ supabase: db, workspaceId: WS, settings: SETTINGS, now: new Date('2094-05-01T12:00:00Z') });
  assert.ok(!p.owner.some((x) => x.event_id === E.aceite && x.kind === 'vocalist_unassigned'), 'pedido ativo: não duplica pendência');
  const res = await respond(inviteId, 'accept', 'voz.m');
  assert.equal(res.status, 200, await res.clone().text());
  assert.equal((await sql('select status from ai_vocalist_requests where id = $1', [request.id]))[0].status, 'accepted');
  const [crew] = await sql('select role, status from event_musicians where event_id = $1 and musician_id = $2', [E.aceite, C.vozM]);
  assert.deepEqual([crew.role, crew.status], ['Vocal Masculino', 'confirmed']);
  p = await vocalistPendencies({ supabase: db, workspaceId: WS, settings: SETTINGS, now: new Date('2094-05-01T12:00:00Z') });
  assert.ok(!p.owner.some((x) => x.event_id === E.aceite || x.request_id === request.id), 'sem pendência para o evento aceito');
  // Resposta repetida/tardia de outro pedido encerrado é recusada (não reconfirma nada).
  const late = await respond((await sql("select invite_id from ai_vocalist_requests where event_id = $1 and status = 'cancelled'", [E.cancela]))[0].invite_id, 'accept', 'voz.f');
  assert.equal(late.status, 409);
  assert.deepEqual(await messageCounts(), baseline, 'nenhuma mensagem/automação para a noiva e nenhum disparo');
});

test('a rota do membro não importa nada que envie mensagens', () => {
  const src = fs.readFileSync(new URL('../../app/api/member/invites/[inviteId]/respond/route.js', import.meta.url), 'utf8');
  const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['next/server', '@/lib/supabase-admin', '@/lib/ai/commercial/vocalists.mjs']);
  assert.doesNotMatch(src, /whatsapp|automation|outbox|sendMessage|fetch\(/i);
});
