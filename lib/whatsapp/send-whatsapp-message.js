import { getDefaultWorkspaceSettings } from '@/lib/automation/get-workspace';
import { getChannel } from '@/lib/automation/get-channel';
import { isLegacyEnvWorkspace } from '@/lib/whatsapp/legacy-env-workspace';
import { normalizeProvider, validateChannelConfig } from '@/lib/whatsapp/channel-config';
import { trackUsageEvent } from '@/lib/usage/track-usage-event';
import { evaluateWhatsappPlanAccess } from '@/lib/billing/whatsapp-plan-access';
import {
  checkWorkspaceFeature,
  checkWorkspaceLimit,
} from '@/lib/billing/check-workspace-plan-limit';
import {
  buildProviderThrottleKey,
  getProviderMinIntervalMs,
  isProviderRateLimitError,
  resolveRateLimitWaitMs,
  waitForProviderSlot,
} from '@/lib/whatsapp/provider-throttle';

const WHATSAPP_PROVIDER_TIMEOUT_MS = 20_000;

/**
 * Verifica se um canal do banco tem os campos mínimos para envio.
 * Um canal inválido (incompleto) é tratado como inexistente — fallback para env vars.
 */
function isChannelValid(channel) {
  return validateChannelConfig(channel).isValid;
}

function shouldEnforceWorkspacePlans() {
  return String(process.env.ENFORCE_WORKSPACE_PLANS || '').toLowerCase() === 'true';
}

function shouldLogWhatsappDebug() {
  return process.env.WHATSAPP_DEBUG === 'true';
}

function maskRecipient(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length <= 4) return '****';
  return `${'*'.repeat(Math.max(digits.length - 4, 4))}${digits.slice(-4)}`;
}

function debugWhatsappLog(label, payload) {
  if (!shouldLogWhatsappDebug()) return;
  console.info(label, payload);
}

function resolveWorkspaceIdFromChannel(channel) {
  return String(channel?.workspace_id || channel?.workspaceId || '').trim() || null;
}

async function checkWhatsappPlanAccess({ supabase, workspaceId }) {
  const resolvedWorkspaceId = String(workspaceId || '').trim();
  if (!resolvedWorkspaceId || !supabase) {
    return { ok: true, allowed: true, skipped: true, reason: 'missing_workspace' };
  }

  return evaluateWhatsappPlanAccess({
    checkFeature: () => checkWorkspaceFeature({ supabase, workspaceId: resolvedWorkspaceId, feature: 'whatsapp' }),
    checkLimit: () => checkWorkspaceLimit({ supabase, workspaceId: resolvedWorkspaceId, limitKey: 'whatsapp_messages', increment: 1 }),
  });
}

/**
 * Resolve endpoint final de envio para WaSender.
 *
 * Regras:
 * - Nunca usar app.wasenderapi.com para envio (é painel/app).
 * - Se vier com endpoint explícito de envio, preserva o path.
 * - Se vier apenas base (/ ou /api), monta /api/send-message no host de API.
 */
function resolveWaSenderSendEndpoint(rawApiUrl) {
  const original = String(rawApiUrl || '').trim();
  const normalizedBase = original || 'https://www.wasenderapi.com';

  let parsed;
  try {
    parsed = new URL(normalizedBase);
  } catch {
    parsed = new URL(`https://${normalizedBase.replace(/^\/+/, '')}`);
  }

  const sourceHost = parsed.hostname.toLowerCase();

  // app.wasenderapi.com = painel. Força host correto de API.
  if (sourceHost === 'app.wasenderapi.com') {
    parsed.hostname = 'www.wasenderapi.com';
    parsed.pathname = '/api/send-message';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  }

  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';

  if (pathname === '/' || pathname === '' || pathname === '/api') {
    parsed.pathname = '/api/send-message';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  }

  return parsed.toString();
}

function resolveSendEndpoint({ apiUrl, provider }) {
  if (!apiUrl) return apiUrl;

  const normalizedProvider = normalizeProvider(provider);
  if (normalizedProvider === 'wasender') {
    return resolveWaSenderSendEndpoint(apiUrl);
  }

  return apiUrl;
}

function buildPayload({ provider, to, message, instanceId }) {
  const normalizedProvider = normalizeProvider(provider);

  // WaSender usa "text" para mensagem de texto.
  if (normalizedProvider === 'wasender') {
    return {
      to,
      text: message,
      instance_id: instanceId || undefined,
    };
  }

  return {
    to,
    message,
    instance_id: instanceId || undefined,
  };
}

async function fetchProviderWithTimeout(endpoint, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WHATSAPP_PROVIDER_TIMEOUT_MS);

  try {
    return await fetch(endpoint, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Envia mensagem via WhatsApp.
 */
export async function sendWhatsAppMessage({ to, message, channel: channelOverride = null, workspaceId: scopedWorkspaceId = null }) {
  let apiUrl;
  let apiKey;
  let instanceId;
  let provider = 'wasender';
  let channelSource = 'env';
  let requestedWorkspaceId = String(scopedWorkspaceId || '').trim() || null;
  if (requestedWorkspaceId && (await isLegacyEnvWorkspace(requestedWorkspaceId))) {
    // Workspace dono das variáveis legadas: comportamento idêntico ao anterior.
    requestedWorkspaceId = null;
  }
  let workspaceId = resolveWorkspaceIdFromChannel(channelOverride) || requestedWorkspaceId;
  let channelId = channelOverride?.id || null;

  if (isChannelValid(channelOverride)) {
    apiUrl = channelOverride.api_url;
    apiKey = channelOverride.api_key;
    instanceId = channelOverride.instance_id;
    provider = channelOverride.provider || provider;
    channelSource = 'database';
  }

  // Multi-tenant: com workspace conhecido, só o canal DESSE workspace pode ser usado.
  // Nunca cair para o canal de outro tenant nem para as variáveis globais (número da Harmonics).
  if (channelSource !== 'database' && requestedWorkspaceId) {
    const scopedChannel = await getChannel(requestedWorkspaceId);
    if (!isChannelValid(scopedChannel)) {
      const error = new Error('Workspace sem canal WhatsApp ativo configurado.');
      error.code = 'WORKSPACE_CHANNEL_NOT_CONFIGURED';
      error.statusCode = 409;
      throw error;
    }
    apiUrl = scopedChannel.api_url;
    apiKey = scopedChannel.api_key;
    instanceId = scopedChannel.instance_id;
    provider = scopedChannel.provider || provider;
    channelSource = 'database';
    channelId = scopedChannel.id || channelId;
  }

  try {
    if (channelSource !== 'database') {
      // Legado: chamadas sem workspace explícito mantêm o comportamento anterior.
      const workspace = await getDefaultWorkspaceSettings();
      workspaceId = workspace?.workspaceId || workspace?.workspace_id || workspace?.id || workspaceId;
      const channel = await getChannel(workspace.id);
      if (isChannelValid(channel)) {
        apiUrl = channel.api_url;
        apiKey = channel.api_key;
        instanceId = channel.instance_id;
        provider = channel.provider || provider;
        channelSource = 'database';
        workspaceId = resolveWorkspaceIdFromChannel(channel) || workspaceId;
        channelId = channel.id || channelId;
      }
    }
  } catch (err) {
    console.error('[sendWhatsAppMessage] Erro ao buscar canal do banco — usando env vars como fallback:', err);
  }

  if (channelSource === 'env') {
    apiUrl = process.env.WHATSAPP_API_URL;
    apiKey = process.env.WHATSAPP_API_KEY;
    instanceId = process.env.WHATSAPP_INSTANCE_ID;
    provider = process.env.WHATSAPP_PROVIDER || provider;
  }

  if (!apiUrl) {
    throw new Error('WHATSAPP_API_URL não configurada');
  }

  const endpoint = resolveSendEndpoint({ apiUrl, provider });
  const payload = buildPayload({ provider, to, message, instanceId });

  if (workspaceId) {
    try {
      const supabaseModule = await import('@/lib/supabase-admin');
      const supabase = supabaseModule.getSupabaseAdmin();
      const planAccess = await checkWhatsappPlanAccess({ supabase, workspaceId });

      if (planAccess.technicalFailure) {
        // Falha ao consultar plano/uso não é falta de plano: o envio segue (fail-open registrado).
        console.warn('[sendWhatsAppMessage][plan_check_failed_open]', {
          workspaceId,
          enforce: shouldEnforceWorkspacePlans(),
          error: planAccess.error,
          code: planAccess.code,
        });
      } else if (!planAccess.allowed) {
        console.warn('[sendWhatsAppMessage][plan_soft_block]', {
          workspaceId,
          enforce: shouldEnforceWorkspacePlans(),
          error: planAccess.error,
          code: planAccess.code,
        });

        if (shouldEnforceWorkspacePlans()) {
          const error = new Error(planAccess.error || 'Limite/recurso de WhatsApp indisponível no plano atual.');
          error.code = planAccess.code || 'WHATSAPP_PLAN_BLOCKED';
          error.statusCode = 402;
          error.details = planAccess;
          throw error;
        }
      }
    } catch (planError) {
      // Só o bloqueio real de plano (402) interrompe o envio; erro técnico segue (fail-open).
      if (planError?.statusCode === 402 && shouldEnforceWorkspacePlans()) {
        throw planError;
      }
      console.warn('[sendWhatsAppMessage][plan_check_failed_soft_allow]', {
        workspaceId,
        message: planError?.message || String(planError),
        code: planError?.code || null,
      });
    }
  }

  debugWhatsappLog('[sendWhatsAppMessage][debug] provider_request', {
    provider,
    channelSource,
    workspaceId,
    channelId,
    providerBaseUrlOriginal: apiUrl,
    endpointFinal: endpoint,
    payloadPreview: {
      to: maskRecipient(to),
      hasText: Boolean(payload.text),
      hasMessage: Boolean(payload.message),
      hasInstanceId: Boolean(payload.instance_id),
    },
  });

  const normalizedProvider = normalizeProvider(provider);
  const minIntervalMs = getProviderMinIntervalMs(normalizedProvider);
  const throttleKey = buildProviderThrottleKey({ provider: normalizedProvider, endpoint, apiKey, instanceId });

  async function callProvider() {
    await waitForProviderSlot(throttleKey, minIntervalMs);

    let response;
    try {
      response = await fetchProviderWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (fetchError) {
      const isAbort = fetchError?.name === 'AbortError';
      const err = new Error(
        isAbort
          ? `Tempo limite ao conectar com provider (${provider}) em ${endpoint}`
          : `Falha de conexão com provider (${provider}) em ${endpoint}: ${fetchError?.message || 'erro de rede'}`
      );
      err.cause = fetchError;
      err.provider = provider;
      err.providerBaseUrl = apiUrl;
      err.providerEndpoint = endpoint;
      err.providerStatus = isAbort ? 504 : null;
      err.providerResponse = null;
      throw err;
    }

    const responseText = await response.text();
    const rawResponseBody = responseText || null;
    let data = {};
    let isJsonResponse = true;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      isJsonResponse = false;
      data = { raw: responseText };
    }

    return { response, rawResponseBody, data, isJsonResponse };
  }

  let { response, rawResponseBody, data, isJsonResponse } = await callProvider();

  // Rate limit da conta (ex.: WaSender "1 message every 5 seconds"): a mensagem NÃO foi aceita,
  // então repetir uma única vez após a espera indicada é seguro (sem risco de envio duplicado).
  if (minIntervalMs > 0 && isProviderRateLimitError(response.status, rawResponseBody)) {
    const waitMs = resolveRateLimitWaitMs({
      retryAfterHeader: response.headers?.get?.('retry-after'),
      body: rawResponseBody,
      fallbackMs: minIntervalMs,
    });
    console.warn('[sendWhatsAppMessage][rate_limited_retry]', {
      provider,
      workspaceId,
      channelId,
      status: response.status,
      waitMs,
    });
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    ({ response, rawResponseBody, data, isJsonResponse } = await callProvider());
  }

  debugWhatsappLog('[sendWhatsAppMessage][debug] provider_response', {
    provider,
    providerBaseUrlOriginal: apiUrl,
    endpointFinal: endpoint,
    status: response.status,
    ok: response.ok,
  });

  const semanticFailure =
    data?.success === false ||
    data?.ok === false ||
    String(data?.status || '').toLowerCase() === 'error' ||
    String(data?.status || '').toLowerCase() === 'failed';

  if (!response.ok || semanticFailure) {
    console.error('[sendWhatsAppMessage][debug] provider_error_response', {
      provider,
      providerBaseUrlOriginal: apiUrl,
      endpointFinal: endpoint,
      status: response.status,
      responseBody: data,
      rawResponseBody,
      isJsonResponse,
    });

    const providerMessage = data?.error || data?.message || data?.raw || 'Falha no provider WhatsApp';
    const err = new Error(
      `Provider ${provider} retornou status ${response.status} em ${endpoint}: ${String(providerMessage).slice(0, 500)}`
    );
    err.provider = provider;
    err.providerBaseUrl = apiUrl;
    err.providerEndpoint = endpoint;
    err.providerStatus = response.status;
    err.providerResponse = data;
    err.providerResponseRaw = rawResponseBody;
    err.cause = providerMessage;
    throw err;
  }

  if (workspaceId) {
    try {
      const supabaseModule = await import('@/lib/supabase-admin');
      const supabase = supabaseModule.getSupabaseAdmin();
      await trackUsageEvent({
        supabase,
        workspaceId,
        eventType: 'whatsapp_message_sent',
        quantity: 1,
        unit: 'message',
        entityType: 'whatsapp_message',
        entityId: null,
        source: 'send_whatsapp_message',
        metadata: {
          provider,
          channelSource,
          channelId,
          endpoint,
          recipientMasked: maskRecipient(to),
          status: response.status,
          providerMessageId: data?.data?.msgId || data?.msgId || data?.id || null,
        },
      });
    } catch (usageError) {
      console.warn('[sendWhatsAppMessage][usage_tracking_failed]', {
        workspaceId,
        message: usageError?.message || String(usageError),
      });
    }
  }

  return { ...data, channel_source: channelSource, provider, endpoint };
}
