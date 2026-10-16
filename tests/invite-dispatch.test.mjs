// Convite de escala (1 imediato) + lembrete único de 5 dias + logs sem violar FK.
// Supabase em memória e provider WhatsApp falso: nenhuma mensagem real é enviada.
import { register } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemorySupabase } from './helpers/memory-supabase.mjs';

register('./helpers/automation-fakes-loader.mjs', import.meta.url);

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'service-role-test-key';
process.env.NEXT_PUBLIC_APP_URL ||= 'https://app.test';
process.env.CRON_SECRET = 'invite-tests-cron-secret';
delete process.env.ENFORCE_WORKSPACE_PLANS;

const { ensureDefaultAutomations, DEFAULT_AUTOMATION_RULE_KEYS } = await import('../lib/automation/ensure-defaults.js');
const { sendInviteService, sendInviteForWorkspace } = await import('../lib/whatsapp/send-invite-service.js');
const { sendInviteReminderService, getInviteReminderCandidates } = await import('../lib/whatsapp/send-invite-reminder-service.js');
const { selectRulesForDispatch, evaluateInviteReminder } = await import('../lib/automation/invite-dispatch.js');
const { GET: cronGET } = await import('../app/api/automation/cron/route.js');

const WS_A = '0a0a0a0a-0000-4000-8000-00000000000a';
const WS_B = '0b0b0b0b-0000-4000-8000-00000000000b';
const EVENT_A = '1a1a1a1a-0000-4000-8000-00000000001a';
const EVENT_A_PAST = '1a1a1a1a-0000-4000-8000-00000000002a';
const EVENT_B = '1b1b1b1b-0000-4000-8000-00000000001b';
const CONTACT_A = '2a2a2a2a-0000-4000-8000-00000000001a';
const CONTACT_B = '2b2b2b2b-0000-4000-8000-00000000001b';
const DAY = 24 * 60 * 60 * 1000;

let inviteSeq = 0;
function inviteId() {
  inviteSeq += 1;
  return `3c3c3c3c-0000-4000-8000-${String(inviteSeq).padStart(12, '0')}`;
}

function futureDate(days) {
  return new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
}

function baseTables() {
  return {
    workspaces: [{ id: WS_A, name: 'A', is_active: true }, { id: WS_B, name: 'B', is_active: true }],
    contacts: [
      { id: CONTACT_A, workspace_id: WS_A, name: 'Músico A', phone: '(71) 99999-0001' },
      { id: CONTACT_B, workspace_id: WS_B, name: 'Músico B', phone: '(71) 99999-0002' },
    ],
    events: [
      { id: EVENT_A, workspace_id: WS_A, client_name: 'Casamento A', event_date: futureDate(40), event_time: '19:00', status: 'Confirmado' },
      { id: EVENT_A_PAST, workspace_id: WS_A, client_name: 'Passado', event_date: futureDate(-3), event_time: '19:00', status: 'Confirmado' },
      { id: EVENT_B, workspace_id: WS_B, client_name: 'Casamento B', event_date: futureDate(40), event_time: '19:00', status: 'Confirmado' },
    ],
    whatsapp_channels: [
      { id: 'ch-a', workspace_id: WS_A, is_active: true, is_default: true },
      { id: 'ch-b', workspace_id: WS_B, is_active: true, is_default: true },
    ],
    message_templates: [
      { id: 'tpl-convite-a', workspace_id: WS_A, key: 'invite_musician_schedule', name: 'Convite', channel: 'whatsapp', recipient_type: 'member', body: 'Convite {nome_membro} {evento_nome}', is_active: true },
    ],
    automation_rules: [
      // Estado real de produção: convite rápido ON, invite_member_auto OFF.
      { id: 'rule-convite-a', workspace_id: WS_A, key: 'convite_escala_rapido', name: 'Convite', event_type: 'invite_member', recipient_type: 'member', template_id: 'tpl-convite-a', is_active: true, created_at: '2026-08-27T00:00:00Z' },
      { id: 'rule-auto-a', workspace_id: WS_A, key: 'invite_member_auto', name: 'Auto', event_type: 'invite_member', recipient_type: 'member', template_id: null, is_active: false, created_at: '2026-04-01T00:00:00Z' },
      // send_time nulo: o teste não depende do horário de São Paulo em que roda.
      { id: 'rule-lembrete-a', workspace_id: WS_A, key: 'lembrete_nao_resposta_rapido', name: 'Lembrete', event_type: 'schedule_no_response_member', recipient_type: 'member', template_id: null, days_after: 5, send_time: null, is_active: true, created_at: '2026-10-16T00:00:00Z' },
      { id: 'rule-lembrete-b', workspace_id: WS_B, key: 'lembrete_nao_resposta_rapido', name: 'Lembrete', event_type: 'schedule_no_response_member', recipient_type: 'member', template_id: null, days_after: 5, send_time: null, is_active: true, created_at: '2026-10-16T00:00:00Z' },
    ],
    invites: [],
    automation_logs: [],
  };
}

function setup({ mutate } = {}) {
  const tables = baseTables();
  mutate?.(tables);
  const supabase = createMemorySupabase({
    tables,
    unique: { automation_rules: [['workspace_id', 'key']], message_templates: [['workspace_id', 'key']] },
    foreignKeys: {
      automation_logs: { event_id: 'events', invite_id: 'invites', workspace_id: 'workspaces' },
    },
  });
  globalThis.__MEMORY_SUPABASE__ = supabase;
  globalThis.__WHATSAPP_SENT__ = [];
  globalThis.__WHATSAPP_BEHAVIOR__ = null;
  return supabase;
}

function addInvite(supabase, overrides = {}) {
  const row = {
    id: inviteId(),
    event_id: EVENT_A,
    contact_id: CONTACT_A,
    status: 'pending',
    invite_token: 'tok',
    whatsapp_sent_at: null,
    whatsapp_send_count: 0,
    sent_at: null,
    reminder_5d_claimed_at: null,
    reminder_5d_sent_at: null,
    reminder_5d_attempts: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
  supabase.db.invites.push(row);
  return row;
}

function rulesWithoutTimestamps(supabase) {
  return JSON.stringify(
    supabase.db.automation_rules.map((rule) => {
      const copy = { ...rule };
      delete copy.updated_at;
      return copy;
    })
  );
}

function sentMessages() {
  return globalThis.__WHATSAPP_SENT__ || [];
}

async function runCron() {
  const response = await cronGET(
    new Request('https://app.test/api/automation/cron', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })
  );
  assert.equal(response.status, 200);
  return response.json();
}

function quiet(fn) { if (process.env.LOUD) return fn;
  return async () => {
    const original = { info: console.info, error: console.error, warn: console.warn, log: console.log };
    console.info = console.error = console.warn = console.log = () => {};
    try {
      await fn();
    } finally {
      Object.assign(console, original);
    }
  };
}

// ── PR #742: ensureDefaultAutomations preserva o estado configurado ─────────────

test('#742: regra desativada não volta a ser ativada por ensureDefaultAutomations', quiet(async () => {
  const supabase = setup();
  for (let i = 0; i < 3; i += 1) await ensureDefaultAutomations(WS_A);
  const auto = supabase.db.automation_rules.find((r) => r.workspace_id === WS_A && r.key === 'invite_member_auto');
  assert.equal(auto.is_active, false);
}));

test('#742: execução repetida (e concorrente) é idempotente', quiet(async () => {
  const supabase = setup();
  await ensureDefaultAutomations(WS_A);
  const snapshot = rulesWithoutTimestamps(supabase);
  const templatesCount = supabase.db.message_templates.length;
  await Promise.all([ensureDefaultAutomations(WS_A), ensureDefaultAutomations(WS_A), ensureDefaultAutomations(WS_A)]);
  assert.equal(rulesWithoutTimestamps(supabase), snapshot);
  assert.equal(supabase.db.message_templates.length, templatesCount);
  const keys = supabase.db.automation_rules.filter((r) => r.workspace_id === WS_A).map((r) => r.key);
  assert.equal(new Set(keys).size, keys.length, 'sem regra duplicada');
}));

test('#742: defaults novos são criados normalmente (inclui lembrete de 5 dias)', quiet(async () => {
  const supabase = setup({ mutate: (t) => { t.automation_rules = t.automation_rules.filter((r) => r.workspace_id !== WS_B); } });
  await ensureDefaultAutomations(WS_B);
  const rules = supabase.db.automation_rules.filter((r) => r.workspace_id === WS_B);
  assert.deepEqual(rules.map((r) => r.key).sort(), [...DEFAULT_AUTOMATION_RULE_KEYS].sort());
  const reminder = rules.find((r) => r.key === 'lembrete_nao_resposta_rapido');
  assert.equal(reminder.event_type, 'schedule_no_response_member');
  assert.equal(reminder.days_after, 5);
  assert.equal(reminder.is_active, true);
  assert.ok(reminder.template_id, 'lembrete com template vinculado');
}));

test('#742: configuração do admin (texto, template, dias, horário, nome) é preservada', quiet(async () => {
  const supabase = setup({
    mutate: (t) => {
      t.message_templates.push({ id: 'tpl-edit', workspace_id: WS_A, key: 'invite_member_whatsapp', name: 'Meu texto', channel: 'whatsapp', recipient_type: 'member', body: 'texto do admin', is_active: false });
      const rule = t.automation_rules.find((r) => r.id === 'rule-lembrete-a');
      Object.assign(rule, { days_after: 7, send_time: '14:00', name: 'Renomeado', template_id: 'tpl-convite-a', is_active: false });
    },
  });
  await ensureDefaultAutomations(WS_A);
  const template = supabase.db.message_templates.find((r) => r.id === 'tpl-edit');
  assert.equal(template.body, 'texto do admin');
  assert.equal(template.is_active, false);
  const rule = supabase.db.automation_rules.find((r) => r.id === 'rule-lembrete-a');
  assert.deepEqual(
    { days_after: rule.days_after, send_time: rule.send_time, name: rule.name, template_id: rule.template_id, is_active: rule.is_active },
    { days_after: 7, send_time: '14:00', name: 'Renomeado', template_id: 'tpl-convite-a', is_active: false }
  );
}));

// ── Convite imediato ───────────────────────────────────────────────────────────

test('A: músico escalado recebe exatamente 1 convite imediato; log com event_id real e invite_id', quiet(async () => {
  const supabase = setup();
  const invite = addInvite(supabase);
  const result = await sendInviteService({ inviteId: invite.id });
  assert.equal(result.ok, true);
  assert.equal(sentMessages().length, 1);
  assert.equal(sentMessages()[0].to, '71999990001');

  const row = supabase.db.invites.find((r) => r.id === invite.id);
  assert.ok(row.whatsapp_sent_at);
  assert.equal(row.sent_at, row.whatsapp_sent_at, 'sent_at guarda o primeiro envio');
  assert.equal(row.sending_at ?? null, null, 'lock liberado');

  const logs = supabase.db.automation_logs.filter((l) => l.invite_id === invite.id);
  assert.equal(logs.length, 1, 'log persistido (sem violar FK)');
  assert.equal(logs[0].status, 'sent');
  assert.equal(logs[0].event_id, EVENT_A);
  assert.equal(logs[0].rule_id, 'rule-convite-a');
  assert.equal(logs[0].workspace_id, WS_A);
  assert.equal(logs[0].metadata.origin, 'immediate');
  assert.equal(logs[0].metadata.providerMessageId, 'fake-msg-1');
}));

test('A2: mesmo com invite_member_auto reativado por engano, sai 1 convite (uma regra por convite)', quiet(async () => {
  const supabase = setup({ mutate: (t) => { t.automation_rules.find((r) => r.key === 'invite_member_auto').is_active = true; } });
  const invite = addInvite(supabase);
  await sendInviteService({ inviteId: invite.id });
  assert.equal(sentMessages().length, 1);
  const log = supabase.db.automation_logs.find((l) => l.invite_id === invite.id);
  assert.equal(log.rule_id, 'rule-convite-a', 'regra preferida: convite_escala_rapido');
  assert.equal(selectRulesForDispatch('repertoire_pending_15_days_client', [{ id: 1 }, { id: 2 }]).length, 2, 'outros tipos inalterados');
}));

test('B: mesmo endpoint executado duas vezes → 1 envio', quiet(async () => {
  const supabase = setup();
  const invite = addInvite(supabase);
  await sendInviteService({ inviteId: invite.id });
  const second = await sendInviteService({ inviteId: invite.id });
  assert.equal(second.data.skipped, true);
  assert.equal(sentMessages().length, 1);
  // Envio manual pela Central também respeita o convite já enviado.
  const manual = await sendInviteForWorkspace({ inviteId: invite.id, workspaceId: WS_A });
  assert.equal(manual.sent, 0);
  assert.equal(sentMessages().length, 1);
}));

test('C: falha do provider libera nova tentativa; mensagem aceita nunca é repetida', quiet(async () => {
  const supabase = setup();
  const invite = addInvite(supabase);
  let providerCalls = 0;
  globalThis.__WHATSAPP_BEHAVIOR__ = function failFirstCall() {
    providerCalls += 1;
    return providerCalls === 1 ? new Error('Provider wasender retornou status 429') : null;
  };
  const first = await sendInviteService({ inviteId: invite.id });
  assert.equal(first.ok, false);
  assert.equal(sentMessages().length, 0);
  assert.equal(supabase.db.invites.find((r) => r.id === invite.id).sending_at ?? null, null, 'lock liberado após falha');

  const retry = await sendInviteService({ inviteId: invite.id });
  assert.equal(retry.ok, true);
  assert.equal(sentMessages().length, 1);

  // Provider aceitou mas a execução caiu antes de marcar o convite: lock vencido + log "sent".
  const crashed = addInvite(supabase, { sending_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(), sending_token: 'old' });
  supabase.db.automation_logs.push({ id: 'log-crash', workspace_id: WS_A, invite_id: crashed.id, status: 'sent', created_at: new Date(Date.now() - 19 * 60 * 1000).toISOString() });
  const afterCrash = await sendInviteService({ inviteId: crashed.id });
  assert.equal(afterCrash.data.skipped, true);
  assert.equal(sentMessages().length, 1, 'não reenviou a mensagem já aceita');
  assert.ok(supabase.db.invites.find((r) => r.id === crashed.id).whatsapp_sent_at, 'convite marcado como enviado');
}));

test('D: execuções concorrentes (cron/duplo clique/duas instâncias) → 1 envio', quiet(async () => {
  const supabase = setup();
  const invite = addInvite(supabase);
  const results = await Promise.all(Array.from({ length: 5 }, () => sendInviteService({ inviteId: invite.id })));
  assert.equal(sentMessages().length, 1);
  assert.equal(results.filter((r) => Number(r.data?.sent || 0) > 0).length, 1);
}));

// ── Lembrete de 5 dias ─────────────────────────────────────────────────────────

function sentDaysAgo(days) {
  const at = new Date(Date.now() - days * DAY).toISOString();
  return { whatsapp_sent_at: at, sent_at: at, whatsapp_send_count: 1 };
}

test('E: pendente há menos de 5 dias → nenhum lembrete', quiet(async () => {
  const supabase = setup();
  addInvite(supabase, sentDaysAgo(4.9));
  const summary = await runCron();
  assert.equal(sentMessages().length, 0);
  assert.equal(summary.totalSent, 0);
}));

test('F/G: pendente há ≥5 dias → 1 lembrete; cron de novo → nenhum segundo lembrete', quiet(async () => {
  const supabase = setup();
  const invite = addInvite(supabase, sentDaysAgo(5.1));
  await runCron();
  assert.equal(sentMessages().length, 1);
  assert.match(sentMessages()[0].message, /aguardando sua resposta/);
  const row = supabase.db.invites.find((r) => r.id === invite.id);
  assert.ok(row.reminder_5d_sent_at);
  assert.equal(row.reminder_5d_attempts, 1);

  const log = supabase.db.automation_logs.find((l) => l.invite_id === invite.id);
  assert.equal(log.event_id, EVENT_A);
  assert.equal(log.rule_id, 'rule-lembrete-a');
  assert.equal(log.metadata.origin, 'cron');
  assert.equal(log.metadata.attempt, 1);

  await runCron();
  await runCron();
  assert.equal(sentMessages().length, 1, 'no máximo 1 lembrete por convite');
}));

test('F2: 5 dias contam do convite inicial, não de reenvio nem da data do evento', quiet(async () => {
  const supabase = setup();
  // Primeiro envio há 6 dias, reenvio manual ontem: o lembrete já é devido.
  addInvite(supabase, { sent_at: new Date(Date.now() - 6 * DAY).toISOString(), whatsapp_sent_at: new Date(Date.now() - DAY).toISOString() });
  // Nunca recebeu o convite inicial: não há lembrete.
  addInvite(supabase, { created_at: new Date(Date.now() - 10 * DAY).toISOString() });
  await runCron();
  assert.equal(sentMessages().length, 1);
}));

test('H/I/J: aceito, recusado, removido ou evento passado → nenhum lembrete', quiet(async () => {
  const supabase = setup();
  addInvite(supabase, { ...sentDaysAgo(6), status: 'confirmed' });
  addInvite(supabase, { ...sentDaysAgo(6), status: 'declined' });
  addInvite(supabase, { ...sentDaysAgo(6), status: 'removed' });
  addInvite(supabase, { ...sentDaysAgo(6), event_id: EVENT_A_PAST });
  await runCron();
  assert.equal(sentMessages().length, 0);
}));

test('I2: músico responde depois de entrar na fila do cron → lembrete não sai', quiet(async () => {
  const supabase = setup();
  const invite = addInvite(supabase, sentDaysAgo(6));
  const candidates = await getInviteReminderCandidates({ supabaseAdmin: supabase, rule: { days_after: 5 }, workspaceId: WS_A });
  assert.deepEqual(candidates, [invite.id]);
  supabase.db.invites.find((r) => r.id === invite.id).status = 'confirmed';
  const result = await sendInviteReminderService({ inviteId: invite.id, workspaceId: WS_A, rule: { days_after: 5 }, supabaseAdmin: supabase });
  assert.equal(result.status, 'skipped');
  assert.equal(result.reason, 'invite_not_pending');
  assert.equal(sentMessages().length, 0);
}));

test('D2: lembrete concorrente para o mesmo convite → 1 envio', quiet(async () => {
  const supabase = setup();
  const invite = addInvite(supabase, sentDaysAgo(6));
  const runs = await Promise.all(
    Array.from({ length: 4 }, () => sendInviteReminderService({ inviteId: invite.id, workspaceId: WS_A, rule: { days_after: 5 }, supabaseAdmin: supabase }))
  );
  assert.equal(sentMessages().length, 1);
  assert.equal(runs.filter((r) => r.status === 'sent').length, 1);
}));

test('C2: lembrete com erro do provider tenta de novo (até 3x); aceito nunca repete', quiet(async () => {
  const supabase = setup();
  const invite = addInvite(supabase, sentDaysAgo(6));
  globalThis.__WHATSAPP_BEHAVIOR__ = () => new Error('Provider wasender retornou status 429');
  for (let i = 0; i < 4; i += 1) await runCron();
  const row = supabase.db.invites.find((r) => r.id === invite.id);
  assert.equal(row.reminder_5d_attempts, 3, 'para após 3 tentativas');
  assert.equal(row.reminder_5d_sent_at ?? null, null);
  assert.equal(sentMessages().length, 0);
  assert.equal(evaluateInviteReminder({ ...row, event: supabase.db.events[0] }, { workspaceId: WS_A }).reason, 'reminder_attempts_exhausted');

  // Execução que caiu depois do aceite do provider: reivindicação fica, nunca reenvia.
  const crashed = addInvite(supabase, { ...sentDaysAgo(6), reminder_5d_claimed_at: new Date().toISOString(), reminder_5d_attempts: 1 });
  globalThis.__WHATSAPP_BEHAVIOR__ = null;
  await runCron();
  assert.equal(sentMessages().filter((m) => m.to === '71999990001').length, 0);
  assert.equal(supabase.db.invites.find((r) => r.id === crashed.id).reminder_5d_sent_at ?? null, null);
}));

test('K: dois workspaces → isolamento total', quiet(async () => {
  const supabase = setup();
  const inviteA = addInvite(supabase, sentDaysAgo(6));
  const inviteB = addInvite(supabase, { ...sentDaysAgo(6), event_id: EVENT_B, contact_id: CONTACT_B });

  // Candidatos de A nunca incluem convites de B (e vice-versa).
  assert.deepEqual(await getInviteReminderCandidates({ supabaseAdmin: supabase, rule: { days_after: 5 }, workspaceId: WS_A }), [inviteA.id]);
  assert.deepEqual(await getInviteReminderCandidates({ supabaseAdmin: supabase, rule: { days_after: 5 }, workspaceId: WS_B }), [inviteB.id]);
  assert.deepEqual(await getInviteReminderCandidates({ supabaseAdmin: supabase, rule: { days_after: 5 }, workspaceId: null }), []);

  // Lembrete do convite de B pedido no workspace A: recusado.
  const cross = await sendInviteReminderService({ inviteId: inviteB.id, workspaceId: WS_A, rule: { days_after: 5 }, supabaseAdmin: supabase });
  assert.equal(cross.reason, 'workspace_mismatch');

  // Envio manual de convite de B a partir do workspace A: recusado, sem mensagem.
  const manual = await sendInviteForWorkspace({ inviteId: inviteB.id, workspaceId: WS_A });
  assert.equal(manual.ok, false);
  assert.equal(sentMessages().length, 0);

  await runCron();
  assert.deepEqual(sentMessages().map((m) => m.to).sort(), ['71999990001', '71999990002']);
  const logA = supabase.db.automation_logs.find((l) => l.invite_id === inviteA.id);
  const logB = supabase.db.automation_logs.find((l) => l.invite_id === inviteB.id);
  assert.equal(logA.workspace_id, WS_A);
  assert.equal(logA.rule_id, 'rule-lembrete-a');
  assert.equal(logB.workspace_id, WS_B);
  assert.equal(logB.rule_id, 'rule-lembrete-b');
}));

test('logs: falha de convite é registrada sem violar a FK de event_id', quiet(async () => {
  const supabase = setup();
  const invite = addInvite(supabase);
  globalThis.__WHATSAPP_BEHAVIOR__ = () => new Error('Provider wasender retornou status 500');
  await sendInviteService({ inviteId: invite.id });
  const failed = supabase.db.automation_logs.filter((l) => l.invite_id === invite.id && l.status === 'failed');
  assert.ok(failed.length >= 1, 'log de falha persistido');
  for (const log of supabase.db.automation_logs) {
    assert.ok(log.event_id == null || supabase.db.events.some((e) => e.id === log.event_id), 'event_id sempre referencia events');
  }
}));
