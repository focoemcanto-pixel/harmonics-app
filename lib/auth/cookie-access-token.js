// Lê o access token da sessão Supabase gravada em cookie (formato do @supabase/ssr), sem renovar.
//
// Por que existe: guards de API e páginas de servidor não conseguem gravar cookies de volta.
// Se chamassem auth.getUser()/getSession() num cliente de cookies, o auth-js renovaria a sessão
// quando o token está perto de expirar e descartaria os tokens novos. O refresh token que ficou no
// navegador passa a ser "já usado" (refresh_token_already_used) e a sessão do usuário cai, gerando
// loops de login e telas presas carregando. Aqui só lemos o token e o validamos com getUser(token).

function decodeCookieValue(raw) {
  const value = String(raw || '');
  if (!value) return null;
  try {
    if (value.startsWith('base64-')) {
      return Buffer.from(value.slice('base64-'.length), 'base64url').toString('utf8');
    }
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function parseSession(text) {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    // Formatos antigos gravavam [access_token, refresh_token, ...].
    if (Array.isArray(parsed)) return { access_token: parsed[0] || null };
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** @param {{ name: string, value: string }[]} cookieList */
export function getAccessTokenFromCookieList(cookieList = []) {
  const byName = new Map(cookieList.map((cookie) => [cookie.name, cookie.value]));
  const baseNames = [...byName.keys()]
    .map((name) => name.replace(/\.\d+$/, ''))
    .filter((name, index, all) => /^sb-.+-auth-token$/.test(name) && all.indexOf(name) === index);

  for (const baseName of baseNames) {
    let raw = byName.get(baseName);
    if (raw === undefined) {
      const chunks = [];
      for (let index = 0; byName.has(`${baseName}.${index}`); index += 1) chunks.push(byName.get(`${baseName}.${index}`));
      raw = chunks.length ? chunks.join('') : undefined;
    }
    const session = parseSession(decodeCookieValue(raw));
    if (session?.access_token) return String(session.access_token);
  }
  return null;
}

export function getAccessTokenFromRequest(request) {
  const list = typeof request?.cookies?.getAll === 'function' ? request.cookies.getAll() : [];
  return getAccessTokenFromCookieList(list);
}

/**
 * Valida o usuário da sessão em cookie sem renovar tokens. `authClient` é qualquer cliente
 * Supabase (anon, cookie ou service role): getUser(jwt) só consulta /auth/v1/user.
 */
export async function getUserFromCookieSession(authClient, request) {
  const token = getAccessTokenFromRequest(request);
  if (!token || !authClient?.auth?.getUser) return { user: null, error: null };
  const { data, error } = await authClient.auth.getUser(token);
  return { user: data?.user || null, error: error || null };
}
