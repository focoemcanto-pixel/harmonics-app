// Cliente Asaas (server-only). Lê as variáveis no momento da chamada.
//   ASAAS_API_KEY  — chave da conta (sandbox ou produção)
//   ASAAS_ENV      — 'production' usa api.asaas.com; qualquer outro valor usa o sandbox

function baseUrl() {
  return String(process.env.ASAAS_ENV || 'sandbox').toLowerCase() === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3';
}

export function isAsaasConfigured() {
  return Boolean(String(process.env.ASAAS_API_KEY || '').trim());
}

async function asaasFetch(path, { method = 'GET', body, query, fetchImpl = fetch } = {}) {
  const apiKey = String(process.env.ASAAS_API_KEY || '').trim();
  if (!apiKey) {
    const error = new Error('Pagamentos ainda não configurados (ASAAS_API_KEY).');
    error.code = 'ASAAS_NOT_CONFIGURED';
    error.statusCode = 503;
    throw error;
  }

  const url = new URL(`${baseUrl()}${path}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });

  const response = await fetchImpl(url.toString(), {
    method,
    headers: { accept: 'application/json', 'content-type': 'application/json', access_token: apiKey },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.errors?.[0]?.description || `Asaas respondeu ${response.status}.`);
    error.code = 'ASAAS_ERROR';
    error.statusCode = 502;
    error.providerStatus = response.status;
    throw error;
  }
  return payload;
}

export const createCustomer = (data, options) => asaasFetch('/customers', { ...options, method: 'POST', body: data });
export const createSubscription = (data, options) => asaasFetch('/subscriptions', { ...options, method: 'POST', body: data });
export const updateSubscription = (id, data, options) => asaasFetch(`/subscriptions/${encodeURIComponent(id)}`, { ...options, method: 'POST', body: data });
export const cancelSubscription = (id, options) => asaasFetch(`/subscriptions/${encodeURIComponent(id)}`, { ...options, method: 'DELETE' });
export const listSubscriptionPayments = (id, options) =>
  asaasFetch(`/subscriptions/${encodeURIComponent(id)}/payments`, { ...options, query: { limit: 10 } });
