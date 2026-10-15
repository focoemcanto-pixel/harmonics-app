import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeSupabase } from './helpers/fake-supabase.mjs';

const {
  validateWhatsAppRecipient,
  isInvalidJidMessage,
  checkRecipientBeforeSend,
  RECIPIENT_SKIP_REASONS,
} = await import('../lib/automation/recipient-guard.js');

const WORKSPACE = 'f36dcd9b-22a9-487a-bf2e-691d17bd6294';
const NOW = new Date('2026-10-15T12:00:00Z');
const JID_ERROR =
  'Provider wasender retornou status 422 em https://www.wasenderapi.com/api/send-message: The provided JID does not exist on WhatsApp.';

test('aceita os formatos que já são enviados com sucesso hoje (sem mudar o número)', () => {
  for (const value of ['7199990000', '7189990000', '71999990000', '(71) 99999-0000', '5571999990000', '557199990000']) {
    const result = validateWhatsAppRecipient(value);
    assert.equal(result.ok, true, value);
    assert.equal(result.digits, value.replace(/\D/g, ''), 'não normaliza/reescreve o número');
  }
});

test('recusa formatos que o provider não aceitaria', () => {
  const cases = {
    '': RECIPIENT_SKIP_REASONS.missing,
    '999990000': RECIPIENT_SKIP_REASONS.invalidFormat, // sem DDD
    '01999990000': RECIPIENT_SKIP_REASONS.invalidFormat, // DDD com 0
    '71899990000': RECIPIENT_SKIP_REASONS.invalidFormat, // 11 dígitos sem o 9
    '447999990000': RECIPIENT_SKIP_REASONS.invalidFormat, // 12 dígitos sem 55
    '12036302123456789': RECIPIENT_SKIP_REASONS.invalidFormat, // id de grupo
  };
  for (const [value, reason] of Object.entries(cases)) {
    const result = validateWhatsAppRecipient(value);
    assert.equal(result.ok, false, value);
    assert.equal(result.reason, reason, value);
    assert.match(result.message, /WhatsApp/);
  }
});

test('reconhece a mensagem de JID inexistente da WaSender', () => {
  assert.equal(isInvalidJidMessage(JID_ERROR), true);
  assert.equal(isInvalidJidMessage('Provider wasender retornou status 429: account protection'), false);
  assert.equal(isInvalidJidMessage(null), false);
});

function logsSupabase(rows) {
  return createFakeSupabase({ tables: { automation_logs: rows } });
}

test('pula (sem chamar provider) número que teve 422 JID nos últimos 30 dias', async () => {
  const supabase = logsSupabase([
    { id: 'log-1', workspace_id: WORKSPACE, recipient_number: '71999990000', status: 'failed', created_at: '2026-10-08T18:35:37Z', error_message: JID_ERROR },
  ]);
  const result = await checkRecipientBeforeSend({ supabase, workspaceId: WORKSPACE, recipient: '71999990000', now: NOW });
  assert.equal(result.ok, false);
  assert.equal(result.reason, RECIPIENT_SKIP_REASONS.knownInvalidJid);
  assert.equal(result.previousLogId, 'log-1');
  assert.match(result.message, /2026-10-08/);
});

test('não pula por outros erros, outro número, outro workspace, logs skipped ou falha antiga', async () => {
  const supabase = logsSupabase([
    { id: 'a', workspace_id: WORKSPACE, recipient_number: '71999990000', status: 'failed', created_at: '2026-10-09T18:06:24Z', error_message: 'status 429 account protection' },
    { id: 'b', workspace_id: WORKSPACE, recipient_number: '71988880000', status: 'failed', created_at: '2026-10-08T18:35:37Z', error_message: JID_ERROR },
    { id: 'c', workspace_id: '00000000-0000-0000-0000-000000000001', recipient_number: '71999990000', status: 'failed', created_at: '2026-10-08T18:35:37Z', error_message: JID_ERROR },
    { id: 'd', workspace_id: WORKSPACE, recipient_number: '71999990000', status: 'skipped', created_at: '2026-10-10T18:35:37Z', error_message: 'Número sem WhatsApp ... does not exist on WhatsApp' },
    { id: 'e', workspace_id: WORKSPACE, recipient_number: '71999990000', status: 'failed', created_at: '2026-09-01T18:35:37Z', error_message: JID_ERROR },
  ]);
  const result = await checkRecipientBeforeSend({ supabase, workspaceId: WORKSPACE, recipient: '71999990000', now: NOW });
  assert.equal(result.ok, true);
});

test('erro ao consultar logs não bloqueia o envio (fail-open)', async () => {
  const supabase = { from() { throw new Error('db down'); } };
  const result = await checkRecipientBeforeSend({ supabase, workspaceId: WORKSPACE, recipient: '71999990000', now: NOW });
  assert.equal(result.ok, true);
});

test('formato inválido é decidido sem consultar o banco', async () => {
  const supabase = logsSupabase([]);
  const result = await checkRecipientBeforeSend({ supabase, workspaceId: WORKSPACE, recipient: '123', now: NOW });
  assert.equal(result.ok, false);
  assert.equal(result.reason, RECIPIENT_SKIP_REASONS.invalidFormat);
  assert.equal(supabase.stats.from, 0);
});

test('guarda só se aplica aos fluxos agendados do cron (instantâneos mantêm o comportamento anterior)', async () => {
  const { shouldGuardRecipient } = await import('../lib/automation/recipient-guard.js');
  for (const eventType of [
    'repertoire_pending_15_days_client',
    'payment_pending_2_days_client',
    'post_event_review_request_client',
    'schedule_pending_15_days_admin',
    'event_day_confirmation_client',
  ]) {
    assert.equal(shouldGuardRecipient(eventType), true, eventType);
  }
  for (const eventType of [
    'invite_member',
    'contract_signed_client',
    'contract_signed_admin',
    'contract_review_released_client',
    'repertoire_review_released_client',
  ]) {
    assert.equal(shouldGuardRecipient(eventType), false, eventType);
  }
});
