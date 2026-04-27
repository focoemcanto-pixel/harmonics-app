function asString(value) {
  return String(value || '').trim();
}

function getFirstForwardedIp(value) {
  const normalized = asString(value);
  if (!normalized) return null;

  const first = normalized.split(',')[0];
  const ip = asString(first);
  return ip || null;
}

export function getRequestIp(request) {
  const cfIp = asString(request?.headers?.get('cf-connecting-ip'));
  if (cfIp) return cfIp;

  const forwardedFor = getFirstForwardedIp(request?.headers?.get('x-forwarded-for'));
  if (forwardedFor) return forwardedFor;

  const realIp = asString(request?.headers?.get('x-real-ip'));
  if (realIp) return realIp;

  return null;
}

export function getUserAgent(request) {
  const ua = asString(request?.headers?.get('user-agent'));
  return ua || null;
}
