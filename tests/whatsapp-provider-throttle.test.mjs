import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'service-role-test-key';

const throttle = await import('../lib/whatsapp/provider-throttle.js');
const { sendWhatsAppMessage } = await import('../lib/whatsapp/send-whatsapp-message.js');

const WASENDER_429_BODY = JSON.stringify({
  success: false,
  message: 'You have account protection enabled. You can only send 1 message every 5 seconds.',
});

function fakeClock(start = 1_000) {
  let now = start;
  const sleeps = [];
  return {
    sleeps,
    now: () => now,
    advance: (ms) => { now += ms; },
    sleep: async (ms) => { sleeps.push(ms); now += ms; },
  };
}

test('intervalo mínimo só se aplica à WaSender e respeita override por env', () => {
  delete process.env.WASENDER_MIN_SEND_INTERVAL_MS;
  assert.equal(throttle.getProviderMinIntervalMs('wasender'), 5_500);
  assert.equal(throttle.getProviderMinIntervalMs('z-api'), 0);
  process.env.WASENDER_MIN_SEND_INTERVAL_MS = '7000';
  assert.equal(throttle.getProviderMinIntervalMs('wasender'), 7_000);
  delete process.env.WASENDER_MIN_SEND_INTERVAL_MS;
});

test('envios em sequência no mesmo canal são espaçados (cenário do 429 de 09/10: 2º envio 1,7s depois)', async () => {
  throttle.__resetProviderThrottleForTests();
  const clock = fakeClock();
  assert.equal(await throttle.waitForProviderSlot('canal-a', 5_500, clock), 0, 'primeiro envio não espera');
  clock.advance(1_700);
  assert.equal(await throttle.waitForProviderSlot('canal-a', 5_500, clock), 3_800);
  // outro canal/conta não é afetado
  assert.equal(await throttle.waitForProviderSlot('canal-b', 5_500, clock), 0);
  clock.advance(10_000);
  assert.equal(await throttle.waitForProviderSlot('canal-a', 5_500, clock), 0);
});

test('chamadas concorrentes no mesmo canal são serializadas', async () => {
  throttle.__resetProviderThrottleForTests();
  const clock = fakeClock();
  const waits = await Promise.all([
    throttle.waitForProviderSlot('canal-a', 5_000, clock),
    throttle.waitForProviderSlot('canal-a', 5_000, clock),
    throttle.waitForProviderSlot('canal-a', 5_000, clock),
  ]);
  assert.deepEqual(waits, [0, 5_000, 5_000]);
});

test('detecta rate limit e calcula a espera a partir da resposta da WaSender', () => {
  assert.equal(throttle.isProviderRateLimitError(429, ''), true);
  assert.equal(throttle.isProviderRateLimitError(400, WASENDER_429_BODY), true);
  assert.equal(throttle.isProviderRateLimitError(422, '{"message":"The provided JID does not exist on WhatsApp."}'), false);
  assert.equal(throttle.resolveRateLimitWaitMs({ body: WASENDER_429_BODY }), 5_500);
  assert.equal(throttle.resolveRateLimitWaitMs({ retryAfterHeader: '3', body: WASENDER_429_BODY }), 3_250);
  assert.equal(throttle.resolveRateLimitWaitMs({ retryAfterHeader: '600' }), 15_000, 'espera é limitada');
});

function installFetch(responses) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    const next = responses.shift();
    return new Response(next.body, { status: next.status, headers: next.headers || {} });
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const channel = {
  id: 'channel-1',
  provider: 'wasender',
  api_url: 'https://www.wasenderapi.com',
  api_key: 'test-key',
  instance_id: 'instance-1',
};

test('sendWhatsAppMessage repete uma única vez após 429 de account protection', async () => {
  throttle.__resetProviderThrottleForTests();
  process.env.WASENDER_MIN_SEND_INTERVAL_MS = '1';
  process.env.WASENDER_RATE_LIMIT_MAX_WAIT_MS = '5';
  const fetchMock = installFetch([
    { status: 429, body: WASENDER_429_BODY },
    { status: 200, body: JSON.stringify({ success: true, data: { msgId: 1 } }) },
  ]);
  try {
    const result = await sendWhatsAppMessage({ to: '71999990000', message: 'teste', channel });
    assert.equal(result.success, true);
    assert.equal(fetchMock.calls.length, 2);
    assert.equal(fetchMock.calls[0].url, 'https://www.wasenderapi.com/api/send-message');
    assert.deepEqual(fetchMock.calls[1].body, fetchMock.calls[0].body, 'mesmo payload na repetição');
  } finally {
    fetchMock.restore();
    delete process.env.WASENDER_MIN_SEND_INTERVAL_MS;
    delete process.env.WASENDER_RATE_LIMIT_MAX_WAIT_MS;
  }
});

test('sendWhatsAppMessage não repete além de uma vez e propaga o 429', async () => {
  throttle.__resetProviderThrottleForTests();
  process.env.WASENDER_MIN_SEND_INTERVAL_MS = '1';
  process.env.WASENDER_RATE_LIMIT_MAX_WAIT_MS = '5';
  const fetchMock = installFetch([
    { status: 429, body: WASENDER_429_BODY },
    { status: 429, body: WASENDER_429_BODY },
  ]);
  try {
    await assert.rejects(
      sendWhatsAppMessage({ to: '71999990000', message: 'teste', channel }),
      (err) => err.providerStatus === 429
    );
    assert.equal(fetchMock.calls.length, 2);
  } finally {
    fetchMock.restore();
    delete process.env.WASENDER_MIN_SEND_INTERVAL_MS;
    delete process.env.WASENDER_RATE_LIMIT_MAX_WAIT_MS;
  }
});

test('sendWhatsAppMessage não repete erros que não são rate limit (ex.: 422 JID inválido)', async () => {
  throttle.__resetProviderThrottleForTests();
  process.env.WASENDER_MIN_SEND_INTERVAL_MS = '1';
  const fetchMock = installFetch([
    { status: 422, body: JSON.stringify({ success: false, message: 'The provided JID does not exist on WhatsApp.' }) },
  ]);
  try {
    await assert.rejects(
      sendWhatsAppMessage({ to: '71999990000', message: 'teste', channel }),
      (err) => err.providerStatus === 422
    );
    assert.equal(fetchMock.calls.length, 1);
  } finally {
    fetchMock.restore();
    delete process.env.WASENDER_MIN_SEND_INTERVAL_MS;
  }
});
