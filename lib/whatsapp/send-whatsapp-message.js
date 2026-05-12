import { getDefaultWorkspaceSettings } from '@/lib/automation/get-workspace';
import { getChannel } from '@/lib/automation/get-channel';
import { normalizeProvider, validateChannelConfig } from '@/lib/whatsapp/channel-config';
import { trackUsageEvent } from '@/lib/usage/track-usage-event';
import {
  checkWorkspaceFeature,
  checkWorkspaceLimit,
} from '@/lib/billing/check-workspace-plan-limit';

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

function resolveWorkspaceIdFromChannel(channel) {
  return String(channel?.workspace_id || channel?.workspaceId || '').trim() || null;
}

async function checkWhatsappPlanAccess({ supabase, workspaceId }) {
  const resolvedWorkspaceId = String(workspaceId || '').trim();
  if (!resolvedWorkspaceId || !supabase) {
    return { ok: true, skipped: true, reason: 'missing_workspace' };
  }

  const feature = await checkWorkspaceFeature({
    supabase,
    workspaceId: resolvedWorkspaceId,
    feature: 'whatsapp',
  });

  const limit = await checkWorkspaceLimit({
    supabase,
    workspaceId: resolvedWorkspaceId,
    limitKey: 'whatsapp_messages',
    increment: 1,
  });

  const allowed = feature.allowed !== false && limit.allowed !== false;

  return {
    ok: true,
    allowed,
    feature,
    limit,
    error: feature.error || limit.error || null,
    code: feature.code || limit.code || null,
  };
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

/**
 * Envia mensagem via WhatsApp.
 */
export async function sendWhatsAppMessage({ to, message, channel: channelOverride = null }) {
  let apiUrl;
  let apiKey;
  let instanceId;
  let provider = 'wasender';
  let channelSource = 'env';
  let workspaceId = resolveWorkspaceIdFromChannel(channelOverride);
  let channelId = channelOverride?.id || null;

  if (isChannelValid(channelOverride)) {
    apiUrl = channelOverride.api_url;
    apiKey = channelOverride.api_key;
    instanceId = channelOverride.instance_id;
    provider = channelOverride.provider || provider;
    channelSource = 'database';
  }

  try {
    if (channelSource !== 'database') {
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

      if (!planAccess.allowed) {
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
      if (shouldEnforceWorkspacePlans()) {
        throw planError;
      }
      console.warn('[sendWhatsAppMessage][plan_check_failed_soft_allow]', {
        workspaceId,
        message: planError?.message || String(planError),
        code: planError?.code || null,
      });
    }
  }

  console.info('[sendWhatsAppMessage][debug] provider_request', {
    provider,
    channelSource,
    workspaceId,
    channelId,
    providerBaseUrlOriginal: apiUrl,
    endpointFinal: endpoint,
    payloadPreview: {
      to,
      hasText: Boolean(payload.text),
      hasMessage: Boolean(payload.message),
      hasInstanceId: Boolean(payload.instance_id),
    },
  });

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (fetchError) {
    const err = new Error(`Falha de conexão com provider (${provider}) em ${endpoint}: ${fetchError?.message || 'erro de rede'}`);
    err.cause = fetchError;
    err.provider = provider;
    err.providerBaseUrl = apiUrl;
    err.providerEndpoint = endpoint;
    err.providerStatus = null;
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

  console.info('[sendWhatsAppMessage][debug] provider_response', {
    provider,
    providerBaseUrlOriginal: apiUrl,
    endpointFinal: endpoint,
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
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
          recipient: to,
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
