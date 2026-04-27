/**
 * Best-effort em memória para ambiente server/runtime único.
 * Em produção com múltiplas instâncias, usar KV/Upstash/Supabase para consistência global.
 */
const RATE_LIMIT_STORE_KEY = '__harmonicsRateLimitStore__';

function getStore() {
  if (!globalThis[RATE_LIMIT_STORE_KEY]) {
    globalThis[RATE_LIMIT_STORE_KEY] = new Map();
  }

  return globalThis[RATE_LIMIT_STORE_KEY];
}

function nowMs() {
  return Date.now();
}

export function checkRateLimit({ key, limit, windowMs }) {
  const normalizedKey = String(key || '').trim();
  const normalizedLimit = Number(limit);
  const normalizedWindowMs = Number(windowMs);

  if (!normalizedKey || !Number.isFinite(normalizedLimit) || !Number.isFinite(normalizedWindowMs)) {
    return { ok: true };
  }

  const store = getStore();
  const now = nowMs();
  const windowStart = now - normalizedWindowMs;

  const attempts = (store.get(normalizedKey) || []).filter((ts) => ts > windowStart);

  if (attempts.length >= normalizedLimit) {
    const oldestInWindow = attempts[0] || now;
    const retryAfterMs = Math.max(0, normalizedWindowMs - (now - oldestInWindow));
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  attempts.push(now);
  store.set(normalizedKey, attempts);

  return { ok: true };
}
