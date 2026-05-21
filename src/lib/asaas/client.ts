const ASAAS_ENV = String(process.env.ASAAS_ENV || 'sandbox').toLowerCase();
const ASAAS_API_KEY = String(process.env.ASAAS_API_KEY || '');

const BASE_URL = ASAAS_ENV === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';

type AsaasRequestOptions = RequestInit & { query?: Record<string, string | number | undefined> };

async function asaasFetch<T>(path: string, options: AsaasRequestOptions = {}): Promise<T> {
  if (!ASAAS_API_KEY) throw new Error('ASAAS_API_KEY não configurada.');
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(options.query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      access_token: ASAAS_API_KEY,
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.errors?.[0]?.description || `Asaas erro ${response.status}`);
  return payload as T;
}

export const createCustomer = (data: Record<string, unknown>) => asaasFetch('/customers', { method: 'POST', body: JSON.stringify(data) });
export const createSubscription = (data: Record<string, unknown>) => asaasFetch('/subscriptions', { method: 'POST', body: JSON.stringify(data) });
export const cancelSubscription = (id: string) => asaasFetch(`/subscriptions/${id}`, { method: 'DELETE' });
export const getSubscription = (id: string) => asaasFetch(`/subscriptions/${id}`);
export const createCheckoutLink = (data: Record<string, unknown>) => asaasFetch('/checkoutSessions', { method: 'POST', body: JSON.stringify(data) });
export const getPayment = (id: string) => asaasFetch(`/payments/${id}`);

export { BASE_URL };
