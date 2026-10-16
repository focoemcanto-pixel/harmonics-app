// Identidade/idempotência das automações não-convite (contratos e eventos) e logs sem
// violar FK. Supabase em memória (com FKs e unique) e provider falso: nada é enviado.
import { register } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemorySupabase } from './helpers/memory-supabase.mjs';

register('./helpers/automation-fakes-loader.mjs', import.meta.url);

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'service-role-test-key';
process.env.NEXT_PUBLIC_APP_URL ||= 'https://app.test';
delete process.env.ENFORCE_WORKSPACE_PLANS;
delete process.env.ADMIN_WHATSAPP_PHONE;

const { executeAutomationEvent } = await import('../lib/automation/execute-automation-event.js');
const { sendInviteService } = await import('../lib/whatsapp/send-invite-service.js');
const { buildDedupeKey, resolveDispatchEntityType } = await import('../lib/automation/dispatch-identity.js');

const WS_A = '0a0a0a0a-0000-4000-8000-00000000000a';
const WS_B = '0b0b0b0b-0000-4000-8000-00000000000b';
const EVENT_A = '1a1a1a1a-0000-4000-8000-00000000001a';
const EVENT_B = '1b1b1b1b-0000-4000-8000-00000000001b';
const PRE_A = '4a4a4a4a-0000-4000-8000-00000000001a';
const PRE_B = '4b4b4b4b-0000-4000-8000-00000000001b';
const CONTRACT_A = '5a5a5a5a-0000-4000-8000-00000000001a';
const CONTACT_A = '2a2a2a2a-0000-4000-8000-00000000001a';
const INVITE_A = '3c3c3c3c-0000-4000-8000-000000000001';

const CLIENT_A = '71999990011';
const CLIENT_B = '71999990022';
const ADMIN_A = '71999990099';
const ADMIN_B = '71999990088';

function rule(id, workspaceId, key, eventType, extra = {}) {
  return { id, workspace_id: workspaceId, key, name: key, event_type: eventType, recipient_type: 'client', template_id: null, is_active: true, created_at: '2026-05-01T00:00:00Z', ...extra };
}

const RULE_IDS = {
  signedClientA: '6a000000-0000-4000-8000-000000000001',
  signedAdminA: '6a000000-0000-4000-8000-000000000002',
  reviewA: '6a000000-0000-4000-8000-000000000003',
  repReviewA: '6a000000-0000-4000-8000-000000000004',
  repPendingA: '6a000000-0000-4000-8000-000000000005',
  inviteA: '6a000000-0000-4000-8000-000000000006',
  signedAdminB: '6b000000-0000-4000-8000-000000000002',
};

function eventDateIn(days) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(Date.now() + days * 86400000));
  const v = (t) => parts.find((p) => p.type === t).value;
  return `${v('year')}-${v('month')}-${v('day')}`;
}

function setup({ mutate } = {}) {
  const tables = {
    workspaces: [{ id: WS_A, name: 'A', is_active: true }, { id: WS_B, name: 'B', is_active: true }],
    contacts: [{ id: CONTACT_A, workspace_id: WS_A, name: 'Músico', phone: '71999990055' }],
    events: [
      { id: EVENT_A, workspace_id: WS_A, client_name: 'Noivos A', event_date: eventDateIn(15), event_time: '19:00', status: 'Confirmado', whatsapp_phone: CLIENT_A },
      { id: EVENT_B, workspace_id: WS_B, client_name: 'Noivos B', event_date: eventDateIn(15), event_time: '19:00', status: 'Confirmado', whatsapp_phone: CLIENT_B },
    ],
    precontracts: [
      { id: PRE_A, workspace_id: WS_A, event_id: EVENT_A, client_name: 'Noivos A', client_phone: CLIENT_A, public_token: 'tok-a', status: 'signed', event_date: eventDateIn(15), event_time: '19:00', created_at: '2026-09-01T00:00:00Z' },
      { id: PRE_B, workspace_id: WS_B, event_id: EVENT_B, client_name: 'Noivos B', client_phone: CLIENT_B, public_token: 'tok-b', status: 'signed', event_date: eventDateIn(15), event_time: '19:00', created_at: '2026-09-01T00:00:00Z' },
    ],
    contracts: [{ id: CONTRACT_A, workspace_id: WS_A, precontract_id: PRE_A, event_id: EVENT_A, public_token: 'ctok-a', status: 'signed', created_at: '2026-09-02T00:00:00Z' }],
    invites: [{ id: INVITE_A, event_id: EVENT_A, contact_id: CONTACT_A, status: 'pending', invite_token: 't', whatsapp_sent_at: null, whatsapp_send_count: 0 }],
    whatsapp_channels: [
      { id: 'ch-a', workspace_id: WS_A, is_active: true, is_default: true, admin_alert_number: ADMIN_A },
      { id: 'ch-b', workspace_id: WS_B, is_active: true, is_default: true, admin_alert_number: ADMIN_B },
    ],
    message_templates: [],
    automation_rules: [
      rule(RULE_IDS.signedClientA, WS_A, 'contract_signed_client_auto', 'contract_signed_client'),
      rule(RULE_IDS.signedAdminA, WS_A, 'contract_signed_admin_auto', 'contract_signed_admin', { recipient_type: 'admin' }),
      rule(RULE_IDS.reviewA, WS_A, 'contract_review_released_client_auto', 'contract_review_released_client'),
      rule(RULE_IDS.repReviewA, WS_A, 'repertoire_review_released_client_auto', 'repertoire_review_released_client'),
      rule(RULE_IDS.repPendingA, WS_A, 'lembrete_repertorio_rapido', 'repertoire_pending_15_days_client', { days_before: 15 }),
      rule(RULE_IDS.inviteA, WS_A, 'convite_escala_rapido', 'invite_member', { recipient_type: 'member' }),
      rule(RULE_IDS.signedAdminB, WS_B, 'contract_signed_admin_auto', 'contract_signed_admin', { recipient_type: 'admin' }),
    ],
    repertoire_config: [],
    automation_logs: [],
    automation_dispatch_claims: [],
  };
  mutate?.(tables);
  const supabase = createMemorySupabase({
    tables,
    unique: {
      automation_rules: [['workspace_id', 'key']],
      message_templates: [['workspace_id', 'key']],
      automation_dispatch_claims: [['workspace_id', 'dedupe_key']],
    },
    foreignKeys: {
      automation_logs: { event_id: 'events', invite_id: 'invites', precontract_id: 'precontracts', contract_id: 'contracts', workspace_id: 'workspaces' },
    },
  });
  globalThis.__MEMORY_SUPABASE__ = supabase;
  globalThis.__WHATSAPP_SENT__ = [];
  globalThis.__WHATSAPP_BEHAVIOR__ = null;
  return supabase;
}

const sent = () => globalThis.__WHATSAPP_SENT__ || [];
const sentTo = (phone) => sent().filter((m) => m.to === phone);

function quiet(fn) {
  if (process.env.LOUD) return fn;
  return async function quietTest() {
    const original = { info: console.info, error: console.error, warn: console.warn, log: console.log };
    console.info = console.error = console.warn = console.log = () => {};
    try {
      await fn();
    } finally {
      Object.assign(console, original);
    }
  };
}

function assertLogsRespectForeignKeys(supabase) {
  const exists = (table, id) => supabase.db[table].some((row) => row.id === id);
  for (const log of supabase.db.automation_logs) {
    if (log.event_id) assert.ok(exists('events', log.event_id), `event_id ${log.event_id} não é um evento`);
    if (log.precontract_id) assert.ok(exists('precontracts', log.precontract_id));
    if (log.contract_id) assert.ok(exists('contracts', log.contract_id));
  }
}

test('auditoria: tipo de entidade por automação', () => {
  assert.equal(resolveDispatchEntityType('contract_signed_client'), 'precontract');
  assert.equal(resolveDispatchEntityType('contract_signed_admin'), 'precontract');
  assert.equal(resolveDispatchEntityType('contract_review_released_client'), 'precontract');
  assert.equal(resolveDispatchEntityType('repertoire_review_released_client'), 'event');
  assert.equal(resolveDispatchEntityType('repertoire_pending_15_days_client'), 'event');
  assert.equal(resolveDispatchEntityType('invite_member'), 'unknown', 'convite usa invites (#743)');
  const refs = { entityType: 'precontract', precontractId: PRE_A, eventId: EVENT_A };
  assert.notEqual(
    buildDedupeKey({ eventType: 'contract_signed_admin', refs, ruleId: 'r' }),
    buildDedupeKey({ eventType: 'contract_signed_admin', refs, ruleId: 'r', stageKey: 'unsigned_alert:15d' }),
    'etapas distintas, chaves distintas'
  );
});

test('1: contrato assinado (cliente) dispara uma vez; log com pré-contrato, contrato e evento reais', quiet(async () => {
  const supabase = setup();
  const first = await executeAutomationEvent({ eventType: 'contract_signed_client', entityId: PRE_A, workspaceId: WS_A });
  assert.equal(first.sent, 1);
  await executeAutomationEvent({ eventType: 'contract_signed_client', entityId: PRE_A, workspaceId: WS_A });
  // O mesmo contrato chegando pelo ID do contrato também é a mesma entidade.
  const viaContract = await executeAutomationEvent({ eventType: 'contract_signed_client', entityId: CONTRACT_A, workspaceId: WS_A });
  assert.equal(viaContract.sent, 0);
  assert.equal(sentTo(CLIENT_A).length, 1);

  const logs = supabase.db.automation_logs.filter((l) => l.status === 'sent');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].precontract_id, PRE_A);
  assert.equal(logs[0].contract_id, CONTRACT_A);
  assert.equal(logs[0].event_id, EVENT_A, 'event_id é o evento real, não o pré-contrato');
  assert.equal(logs[0].rule_id, RULE_IDS.signedClientA);
  assert.match(logs[0].metadata.dedupeKey, /^contract_signed_client:precontract:/);
  assertLogsRespectForeignKeys(supabase);
}));

test('2: contrato assinado (admin) dispara uma vez; alerta de "não assinado" não ocupa a chave', quiet(async () => {
  const supabase = setup();
  const alert = await executeAutomationEvent({ eventType: 'contract_signed_admin', entityId: PRE_A, workspaceId: WS_A, stageKey: 'unsigned_alert:15d' });
  assert.equal(alert.sent, 1);
  const signed = await executeAutomationEvent({ eventType: 'contract_signed_admin', entityId: PRE_A, workspaceId: WS_A });
  assert.equal(signed.sent, 1, 'a notificação de assinatura sai mesmo após o alerta');
  const again = await executeAutomationEvent({ eventType: 'contract_signed_admin', entityId: PRE_A, workspaceId: WS_A });
  assert.equal(again.sent, 0);
  assert.equal(sentTo(ADMIN_A).length, 2);
  assertLogsRespectForeignKeys(supabase);
}));

test('2b: histórico antigo (log sem colunas novas, entityId no metadata) continua deduplicando', quiet(async () => {
  setup({
    mutate: (t) => {
      t.automation_logs.push({ id: 'old-log', workspace_id: WS_A, rule_id: RULE_IDS.signedAdminA, status: 'sent', event_id: null, recipient: ADMIN_A, recipient_number: ADMIN_A, metadata: { eventType: 'contract_signed_admin', entityId: PRE_A }, created_at: '2026-05-03T00:00:00Z' });
    },
  });
  const result = await executeAutomationEvent({ eventType: 'contract_signed_admin', entityId: PRE_A, workspaceId: WS_A });
  assert.equal(result.sent, 0);
  assert.equal(result.skipped, 1);
  assert.equal(sent().length, 0);
}));

test('3: retry após falha do provider envia uma vez; mensagem aceita não é repetida', quiet(async () => {
  const supabase = setup();
  let calls = 0;
  globalThis.__WHATSAPP_BEHAVIOR__ = function failOnce() {
    calls += 1;
    return calls === 1 ? new Error('Provider wasender retornou status 429') : null;
  };
  const failed = await executeAutomationEvent({ eventType: 'contract_signed_admin', entityId: PRE_A, workspaceId: WS_A });
  assert.equal(failed.failed, 1);
  assert.equal(supabase.db.automation_dispatch_claims[0].status, 'failed');
  const retry = await executeAutomationEvent({ eventType: 'contract_signed_admin', entityId: PRE_A, workspaceId: WS_A });
  assert.equal(retry.sent, 1);
  const retryAgain = await executeAutomationEvent({ eventType: 'contract_signed_admin', entityId: PRE_A, workspaceId: WS_A });
  assert.equal(retryAgain.sent, 0);
  assert.equal(sentTo(ADMIN_A).length, 1);
  assert.equal(supabase.db.automation_dispatch_claims.length, 1);
  assert.equal(supabase.db.automation_dispatch_claims[0].status, 'sent');
  assert.ok(supabase.db.automation_dispatch_claims[0].log_id, 'reserva aponta para o log enviado');
}));

test('3b: execução que caiu após o aceite (reserva "sending") nunca reenvia', quiet(async () => {
  const supabase = setup();
  await executeAutomationEvent({ eventType: 'contract_signed_client', entityId: PRE_A, workspaceId: WS_A });
  supabase.db.automation_dispatch_claims[0].status = 'sending';
  supabase.db.automation_logs = []; // log também perdido
  const result = await executeAutomationEvent({ eventType: 'contract_signed_client', entityId: PRE_A, workspaceId: WS_A });
  assert.equal(result.sent, 0);
  assert.equal(sentTo(CLIENT_A).length, 1);
}));

test('4: execuções concorrentes não duplicam', quiet(async () => {
  setup();
  const results = await Promise.all([
    ...Array.from({ length: 4 }, () => executeAutomationEvent({ eventType: 'contract_signed_client', entityId: PRE_A, workspaceId: WS_A })),
    ...Array.from({ length: 4 }, () => executeAutomationEvent({ eventType: 'contract_signed_admin', entityId: PRE_A, workspaceId: WS_A })),
    ...Array.from({ length: 4 }, () => executeAutomationEvent({ eventType: 'repertoire_pending_15_days_client', entityId: EVENT_A, workspaceId: WS_A })),
  ]);
  assert.equal(sentTo(ADMIN_A).length, 1);
  assert.equal(sentTo(CLIENT_A).length, 2, '1 contrato assinado + 1 lembrete de repertório');
  assert.equal(results.reduce((sum, r) => sum + r.sent, 0), 3);
}));

test('5: mesma automação em outro workspace não colide; entidade de outro workspace é recusada', quiet(async () => {
  const supabase = setup();
  await executeAutomationEvent({ eventType: 'contract_signed_admin', entityId: PRE_A, workspaceId: WS_A });
  await executeAutomationEvent({ eventType: 'contract_signed_admin', entityId: PRE_B, workspaceId: WS_B });
  assert.equal(sentTo(ADMIN_A).length, 1);
  assert.equal(sentTo(ADMIN_B).length, 1);

  const cross = await executeAutomationEvent({ eventType: 'contract_signed_admin', entityId: PRE_B, workspaceId: WS_A });
  assert.equal(cross.sent, 0);
  assert.match(cross.message, /outro workspace/);
  assert.equal(sent().length, 2);
  const claimWorkspaces = supabase.db.automation_dispatch_claims.map((c) => c.workspace_id).sort();
  assert.deepEqual(claimWorkspaces, [WS_A, WS_B].sort());
}));

test('6: automações de evento continuam funcionando (1 por evento) e revisões notificam 1 vez por liberação', quiet(async () => {
  const supabase = setup();
  // Lembrete de repertório: 1 por evento + regra + destinatário (semântica anterior).
  assert.equal((await executeAutomationEvent({ eventType: 'repertoire_pending_15_days_client', entityId: EVENT_A, workspaceId: WS_A })).sent, 1);
  assert.equal((await executeAutomationEvent({ eventType: 'repertoire_pending_15_days_client', entityId: EVENT_A, workspaceId: WS_A })).sent, 0);
  const repLog = supabase.db.automation_logs.find((l) => l.rule_id === RULE_IDS.repPendingA);
  assert.equal(repLog.event_id, EVENT_A);
  assert.equal(repLog.precontract_id ?? null, null);

  // Revisão de repertório: cada liberação (etapa) uma vez.
  assert.equal((await executeAutomationEvent({ eventType: 'repertoire_review_released_client', entityId: EVENT_A, workspaceId: WS_A, stageKey: 'release:cfg:t1' })).sent, 1);
  assert.equal((await executeAutomationEvent({ eventType: 'repertoire_review_released_client', entityId: EVENT_A, workspaceId: WS_A, stageKey: 'release:cfg:t1' })).sent, 0);
  assert.equal((await executeAutomationEvent({ eventType: 'repertoire_review_released_client', entityId: EVENT_A, workspaceId: WS_A, stageKey: 'release:cfg:t2' })).sent, 1);

  // Revisão de contrato: cada ajuste liberado uma vez.
  assert.equal((await executeAutomationEvent({ eventType: 'contract_review_released_client', entityId: PRE_A, workspaceId: WS_A, stageKey: 'adjustment:1' })).sent, 1);
  assert.equal((await executeAutomationEvent({ eventType: 'contract_review_released_client', entityId: PRE_A, workspaceId: WS_A, stageKey: 'adjustment:1' })).sent, 0);
  assert.equal((await executeAutomationEvent({ eventType: 'contract_review_released_client', entityId: PRE_A, workspaceId: WS_A, stageKey: 'adjustment:2' })).sent, 1);
  const reviewLog = supabase.db.automation_logs.find((l) => l.rule_id === RULE_IDS.reviewA);
  assert.equal(reviewLog.precontract_id, PRE_A);
  assert.equal(reviewLog.event_id, EVENT_A);
  assert.equal(reviewLog.metadata.stageKey, 'adjustment:1');
  assertLogsRespectForeignKeys(supabase);
}));

test('7: convites (#743) permanecem intactos', quiet(async () => {
  const supabase = setup();
  const first = await sendInviteService({ inviteId: INVITE_A });
  assert.equal(first.data.sent, 1);
  const second = await sendInviteService({ inviteId: INVITE_A });
  assert.equal(second.data.skipped, true);
  assert.equal(sentTo('71999990055').length, 1);
  assert.equal(supabase.db.automation_dispatch_claims.length, 0, 'convite não usa a reserva genérica');
  const log = supabase.db.automation_logs.find((l) => l.invite_id === INVITE_A);
  assert.equal(log.event_id, EVENT_A);
  assert.equal(log.precontract_id ?? null, null);
}));

test('8: nenhum log viola FK (pré-contrato com evento apagado, falhas e preflight)', quiet(async () => {
  const supabase = setup({
    mutate: (t) => {
      // Pré-contrato apontando para evento que não existe mais.
      t.precontracts.push({ id: '4a4a4a4a-0000-4000-8000-00000000009a', workspace_id: WS_A, event_id: '1a1a1a1a-0000-4000-8000-0000000000ff', client_name: 'Sem evento', client_phone: CLIENT_A, status: 'signed' });
    },
  });
  globalThis.__WHATSAPP_BEHAVIOR__ = () => new Error('Provider wasender retornou status 500');
  await executeAutomationEvent({ eventType: 'contract_signed_client', entityId: '4a4a4a4a-0000-4000-8000-00000000009a', workspaceId: WS_A });
  await executeAutomationEvent({ eventType: 'contract_signed_admin', entityId: PRE_A, workspaceId: WS_A });
  // Entidade inexistente: falha no preflight, ainda assim log válido.
  await executeAutomationEvent({ eventType: 'contract_review_released_client', entityId: '4a4a4a4a-0000-4000-8000-0000000000aa', workspaceId: WS_A });
  assert.ok(supabase.db.automation_logs.length >= 3, 'todas as falhas foram registradas');
  const orphan = supabase.db.automation_logs.find((l) => l.precontract_id === '4a4a4a4a-0000-4000-8000-00000000009a');
  assert.equal(orphan.event_id ?? null, null, 'evento inexistente não vai para event_id');
  assertLogsRespectForeignKeys(supabase);
}));
