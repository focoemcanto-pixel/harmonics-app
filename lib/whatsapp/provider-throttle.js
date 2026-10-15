// Espaçamento entre envios para o mesmo canal/conta do provider.
//
// A WaSender com "account protection" ativo aceita só 1 mensagem a cada 5s por conta e
// responde HTTP 429 para a segunda mensagem enviada em sequência (ex.: cron com 2+ candidatos).
// O estado é por isolate: cobre os envios em série de uma mesma execução (cron, lote de convites),
// que é onde os 429 aconteciam.

const DEFAULT_WASENDER_MIN_INTERVAL_MS = 5_500;
const MAX_RATE_LIMIT_RETRY_WAIT_MS = 15_000;

const lastSendByKey = new Map();
const queueByKey = new Map();

const defaultClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export function getProviderMinIntervalMs(provider) {
  if (provider !== 'wasender') return 0;
  const raw = Number(process.env.WASENDER_MIN_SEND_INTERVAL_MS);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return DEFAULT_WASENDER_MIN_INTERVAL_MS;
}

/**
 * Aguarda até que o canal identificado por `key` possa enviar de novo e reserva o slot.
 * Chamadas concorrentes para a mesma chave são serializadas.
 */
export async function waitForProviderSlot(key, minIntervalMs, clock = defaultClock) {
  if (!key || !(minIntervalMs > 0)) return 0;

  const previous = queueByKey.get(key) || Promise.resolve();
  let waited = 0;
  const current = previous.then(async () => {
    const last = lastSendByKey.get(key);
    const elapsed = last == null ? Infinity : clock.now() - last;
    if (elapsed < minIntervalMs) {
      waited = minIntervalMs - elapsed;
      await clock.sleep(waited);
    }
    lastSendByKey.set(key, clock.now());
  });
  const settled = current.catch(() => {});
  queueByKey.set(key, settled);
  await current;
  if (queueByKey.get(key) === settled) queueByKey.delete(key);
  return waited;
}

export function isProviderRateLimitError(status, body) {
  if (Number(status) === 429) return true;
  const text = typeof body === 'string' ? body : JSON.stringify(body || {});
  return /account protection|only send 1 message every/i.test(text);
}

function getMaxRateLimitWaitMs() {
  const raw = Number(process.env.WASENDER_RATE_LIMIT_MAX_WAIT_MS);
  if (Number.isFinite(raw) && raw >= 0) return Math.min(raw, MAX_RATE_LIMIT_RETRY_WAIT_MS);
  return MAX_RATE_LIMIT_RETRY_WAIT_MS;
}

/**
 * Tempo de espera antes de repetir um envio recusado por rate limit:
 * Retry-After (segundos) > "every N seconds" na mensagem > intervalo padrão. Limitado a 15s.
 */
export function resolveRateLimitWaitMs({ retryAfterHeader, body, fallbackMs }) {
  const maxWaitMs = getMaxRateLimitWaitMs();
  const capped = (ms) => Math.min(Math.max(ms, 0), maxWaitMs);

  const retryAfterSeconds = Number(retryAfterHeader);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return capped(retryAfterSeconds * 1000 + 250);
  }

  const text = typeof body === 'string' ? body : JSON.stringify(body || {});
  const match = text.match(/every\s+(\d+)\s*seconds?/i);
  if (match) return capped(Number(match[1]) * 1000 + 500);

  return capped(fallbackMs || DEFAULT_WASENDER_MIN_INTERVAL_MS);
}

export function buildProviderThrottleKey({ provider, endpoint, apiKey, instanceId }) {
  // A chave identifica a conta; não precisa (nem deve) ser exibida ou logada.
  return [provider || '', endpoint || '', instanceId || '', apiKey || ''].join('|');
}

export function __resetProviderThrottleForTests() {
  lastSendByKey.clear();
  queueByKey.clear();
}
