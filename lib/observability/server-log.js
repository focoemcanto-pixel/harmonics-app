const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function asString(value) {
  return String(value ?? '').trim();
}

export function maskEmail(email) {
  const normalized = asString(email).toLowerCase();
  const atIndex = normalized.indexOf('@');

  if (atIndex <= 0) return normalized ? '***' : '';

  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const visible = local.slice(0, 1);

  return `${visible}***@${domain}`;
}

export function maskToken(token) {
  const normalized = asString(token);
  if (!normalized) return '';
  if (normalized.length <= 6) return `${normalized.slice(0, 1)}***${normalized.slice(-1)}`;

  return `${normalized.slice(0, 3)}...${normalized.slice(-3)}`;
}

export function safeError(error) {
  const normalized = {
    name: error?.name || 'Error',
    message: error?.message || 'Unknown error',
    code: error?.code || null,
    status: error?.status || null,
  };

  if (!IS_PRODUCTION && error?.stack) {
    normalized.stack = error.stack;
  }

  return normalized;
}

export function logInfo(scope, event, payload = {}) {
  console.info(`[${scope}][${event}]`, payload);
}

export function logWarn(scope, event, payload = {}) {
  console.warn(`[${scope}][${event}]`, payload);
}

export function logError(scope, event, error, payload = {}) {
  console.error(`[${scope}][${event}]`, {
    ...payload,
    error: safeError(error),
  });
}
