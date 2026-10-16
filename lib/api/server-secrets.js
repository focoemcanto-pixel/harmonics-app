// Autenticação servidor-a-servidor (cron e chamadas internas). Sempre falha fechada:
// sem o segredo configurado, nada é aceito. Valores nunca são registrados em log nem
// devolvidos na resposta; a comparação é em tempo constante.
import { NextResponse } from 'next/server';

export function timingSafeEqualString(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function readEnv(env, name) {
  return String(env?.[name] || '').trim();
}

export function readBearerToken(request) {
  const header = String(request?.headers?.get('authorization') || '').trim();
  return /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, '').trim() : '';
}

/**
 * Cron: exige `Authorization: Bearer <CRON_SECRET>`. Não aceita segredo em query string
 * (vazaria em logs de acesso/histórico). Sem CRON_SECRET configurado: 503, nada executa.
 * @returns {{ ok: true } | { ok: false, status: number, reason: string }}
 */
export function verifyCronRequest(request, { env = process.env } = {}) {
  const expected = readEnv(env, 'CRON_SECRET');
  if (!expected) return { ok: false, status: 503, reason: 'cron_secret_not_configured' };
  if (!timingSafeEqualString(readBearerToken(request), expected)) {
    return { ok: false, status: 401, reason: 'invalid_cron_secret' };
  }
  return { ok: true };
}

/**
 * Chamada interna máquina-a-máquina. Padrão: INTERNAL_API_KEY no header `x-internal-key`
 * (o mesmo de lib/api/route-guards). Compatibilidade: INTERNAL_API_SECRET no header
 * `x-internal-api-secret`. Cada par só vale se a variável estiver configurada.
 */
export function verifyInternalRequest(request, { env = process.env } = {}) {
  const pairs = [
    ['INTERNAL_API_KEY', 'x-internal-key'],
    ['INTERNAL_API_SECRET', 'x-internal-api-secret'],
  ];
  for (const [name, header] of pairs) {
    const expected = readEnv(env, name);
    if (!expected) continue;
    const received = String(request?.headers?.get(header) || '').trim();
    if (timingSafeEqualString(received, expected)) return true;
  }
  return false;
}

export function cronDeniedResponse(result, logPrefix = '[CRON]') {
  console.warn(`${logPrefix}[REJECTED]`, { reason: result.reason, status: result.status });
  const error = result.status === 503 ? 'Cron não configurado.' : 'Unauthorized';
  return NextResponse.json({ ok: false, error }, { status: result.status });
}
