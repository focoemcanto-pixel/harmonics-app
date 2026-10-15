// Troca do authorization code por tokens Google, independente do googleapis/gaxios.
//
// No bundle OpenNext/Workers, o gaxios usa o node-fetch empacotado e o header Content-Type
// da resposta chega como null; o gaxios então devolve o corpo como texto, e
// `getToken(code).tokens` vira uma string JSON (sem access_token acessível). Aqui usamos o
// fetch nativo e interpretamos o corpo pelo texto, sem depender do Content-Type.

export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Normaliza o payload de tokens: aceita objeto (formato anterior do googleapis) ou string
 * JSON (formato observado no Worker). Qualquer outra coisa vira null.
 */
export function parseTokenPayload(value) {
  if (isPlainObject(value)) return value;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      return isPlainObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Nomes das chaves presentes, para diagnóstico sem expor valores. */
export function describeTokenPayloadShape(value) {
  return {
    type: Array.isArray(value) ? 'array' : typeof value,
    keys: isPlainObject(value) ? Object.keys(value) : [],
  };
}

export class GoogleTokenExchangeError extends Error {
  constructor(message, { status = null, googleError = null } = {}) {
    super(message);
    this.name = 'GoogleTokenExchangeError';
    this.status = status;
    this.googleError = googleError;
  }
}

/**
 * Troca o authorization code por tokens. Retorna o payload do Google como objeto simples
 * (access_token, refresh_token, expires_in, scope, token_type, id_token...).
 * Erros nunca incluem o code, o client secret ou tokens — só o `error` devolvido pelo Google.
 */
export async function exchangeGoogleAuthorizationCode({
  code,
  clientId,
  clientSecret,
  redirectUri,
  fetchImpl = globalThis.fetch,
  tokenUrl = GOOGLE_OAUTH_TOKEN_URL,
}) {
  if (typeof fetchImpl !== 'function') {
    throw new GoogleTokenExchangeError('fetch indisponível no runtime.');
  }

  const body = new URLSearchParams({
    code: String(code || ''),
    client_id: String(clientId || ''),
    client_secret: String(clientSecret || ''),
    redirect_uri: String(redirectUri || ''),
    grant_type: 'authorization_code',
  });

  let response;
  try {
    response = await fetchImpl(tokenUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: body.toString(),
    });
  } catch (error) {
    throw new GoogleTokenExchangeError(
      `Falha de rede ao contatar o Google: ${error?.name || 'erro'}`
    );
  }

  let text = '';
  try {
    text = await response.text();
  } catch {
    text = '';
  }
  const payload = parseTokenPayload(text);

  if (!response.ok) {
    const googleError =
      typeof payload?.error === 'string' ? payload.error : null;
    throw new GoogleTokenExchangeError(
      `Google recusou a troca do code (HTTP ${response.status}${
        googleError ? `: ${googleError}` : ''
      })`,
      { status: response.status, googleError }
    );
  }

  if (!payload) {
    throw new GoogleTokenExchangeError(
      'Resposta do Google sem JSON de tokens válido.',
      { status: response.status }
    );
  }

  return payload;
}
