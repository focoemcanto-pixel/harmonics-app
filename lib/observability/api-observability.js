import { NextResponse } from 'next/server';
import { safeError } from '@/lib/observability/server-log';

// Observabilidade das APIs: request id, rota, método, status, latência, usuário e workspace,
// em UMA linha JSON por requisição (indexável no Workers Logs / qualquer coletor).
// Nunca registra corpo, tokens, e-mails ou segredos.
//
// Pergunta que isto responde: "o cliente X tentou criar um evento às 14:32 e falhou — por quê?"
//   → filtrar por workspace_id/user_id + route + horário e ler status/error/code.

const AUTH_CONTEXT = Symbol.for('harmonics.auth-context');

export function getRequestId(request) {
  const incoming = request?.headers?.get?.('x-request-id') || request?.headers?.get?.('cf-ray');
  if (incoming && /^[A-Za-z0-9._:-]{6,120}$/.test(incoming)) return incoming;
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Chamado pelos guards de autorização para enriquecer o log da requisição.
export function attachAuthContext(request, { userId = null, workspaceId = null, role = null } = {}) {
  if (!request || typeof request !== 'object') return;
  try {
    request[AUTH_CONTEXT] = { userId, workspaceId, role };
  } catch {
    // objetos de request imutáveis: segue sem contexto
  }
}

function readAuthContext(request) {
  try {
    return request?.[AUTH_CONTEXT] || {};
  } catch {
    return {};
  }
}

export function logApiRequest(entry) {
  const line = JSON.stringify({ type: 'api_request', ts: new Date().toISOString(), ...entry });
  if (entry.status >= 500) console.error(line);
  else if (entry.status >= 400) console.warn(line);
  else console.info(line);
}

export function withApiObservability(handler, { route } = {}) {
  return async function observedHandler(request, context) {
    const startedAt = Date.now();
    const requestId = getRequestId(request);
    let response;
    let thrown = null;

    try {
      response = await handler(request, context);
    } catch (error) {
      thrown = error;
      response = NextResponse.json(
        { ok: false, error: 'Erro interno. Se persistir, informe o código ao suporte.', requestId },
        { status: 500 }
      );
    }

    const auth = readAuthContext(request);
    let errorCode = null;
    if (response && response.status >= 400) {
      try {
        const body = await response.clone().json();
        errorCode = body?.code || null;
      } catch {
        // corpo não-JSON
      }
    }

    logApiRequest({
      requestId,
      route: route || new URL(request.url).pathname,
      method: request.method,
      status: response?.status || 500,
      durationMs: Date.now() - startedAt,
      userId: auth.userId || null,
      workspaceId: auth.workspaceId || null,
      code: errorCode,
      ...(thrown ? { error: safeError(thrown) } : {}),
    });

    try {
      response.headers.set('x-request-id', requestId);
    } catch {
      // headers imutáveis em respostas especiais
    }
    return response;
  };
}
