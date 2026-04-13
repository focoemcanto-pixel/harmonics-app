import { getDefaultWorkspaceSettings } from '@/lib/automation/get-workspace';
import { getChannel } from '@/lib/automation/get-channel';

/**
 * Verifica se um canal do banco tem os campos mínimos para envio.
 * Um canal inválido (incompleto) é tratado como inexistente — fallback para env vars.
 */
function isChannelValid(channel) {
  return !!(channel?.api_url && channel?.api_key);
}

/**
 * Normaliza a URL final de envio do Wasender.
 * Regras:
 * - Se já vier com /api/send-message, usa como está
 * - Se vier de app.wasenderapi.com, força wasenderapi.com/api/send-message
 * - Caso contrário, garante /api/send-message na URL base
 */
function resolveWasenderSendMessageUrl(rawApiUrl) {
  if (!rawApiUrl) return rawApiUrl;

  const trimmedUrl = String(rawApiUrl).trim();

  try {
    const parsedUrl = new URL(trimmedUrl);

    if (parsedUrl.pathname.includes('/api/send-message')) {
      return parsedUrl.toString();
    }

    if (parsedUrl.hostname === 'app.wasenderapi.com') {
      return 'https://wasenderapi.com/api/send-message';
    }

    parsedUrl.pathname = '/api/send-message';
    parsedUrl.search = '';
    parsedUrl.hash = '';

    return parsedUrl.toString();
  } catch {
    // Fallback defensivo para casos em que a URL venha sem protocolo ou malformada.
    if (trimmedUrl.includes('/api/send-message')) {
      return trimmedUrl;
    }

    if (trimmedUrl.includes('app.wasenderapi.com')) {
      return 'https://wasenderapi.com/api/send-message';
    }

    return `${trimmedUrl.replace(/\/+$/, '')}/api/send-message`;
  }
}

function hasExplicitPath(urlString) {
  try {
    const parsed = new URL(urlString);
    return parsed.pathname && parsed.pathname !== '/';
  } catch {
    return false;
  }
}

function normalizeProvider(provider) {
  return String(provider || 'wasender').trim().toLowerCase();
}

/**
 * Resolve endpoint final de envio por provider.
 * Regra:
 * - Se api_url já tiver path explícito, assume endpoint completo e mantém como está.
 * - Se vier apenas base (ex.: https://www.wasenderapi.com), adiciona path de envio do provider.
 */
function resolveSendEndpoint({ apiUrl, provider }) {
  if (!apiUrl) return apiUrl;
  if (hasExplicitPath(apiUrl)) return apiUrl;

  const normalizedProvider = normalizeProvider(provider);
  const base = apiUrl.replace(/\/+$/, '');

  switch (normalizedProvider) {
    case 'wasender':
      return `${base}/api/send-message`;
    default:
      return apiUrl;
  }
}

/**
 * Resolve o endpoint final de envio da WaSender.
 * - Se api_url já aponta para endpoint de envio, preserva.
 * - Se api_url for apenas base (/ ou /api), monta /api/send-message.
 *
 * @param {string} rawApiUrl
 * @returns {string}
 */
function resolveWaSenderSendEndpoint(rawApiUrl) {
  const parsed = new URL(String(rawApiUrl).trim());
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';

  if (pathname === '/' || pathname === '') {
    parsed.pathname = '/api/send-message';
    return parsed.toString();
  }

  if (pathname === '/api') {
    parsed.pathname = '/api/send-message';
    return parsed.toString();
  }

  return parsed.toString();
}

/**
 * Envia mensagem via WhatsApp.
 * Ordem de prioridade para credenciais:
 *   1. Canal ativo/padrão do banco de dados (whatsapp_channels)
 *   2. Variáveis de ambiente (WHATSAPP_API_URL, WHATSAPP_API_KEY)
 *
 * A assinatura pública não muda — compatível com todas as chamadas atuais.
 * O resultado inclui `channel_source` ('database' | 'env') para rastreabilidade futura.
 *
 * @param {{ to: string, message: string, channel?: object|null }} params
 * @returns {Promise<Object>}
 */
export async function sendWhatsAppMessage({ to, message, channel: channelOverride = null }) {
  let apiUrl;
  let apiKey;
  let instanceId;
  let provider = 'wasender';
  let channelSource = 'env';

  // 1. Canal explicitamente resolvido pela regra (quando informado)
  if (isChannelValid(channelOverride)) {
    apiUrl = channelOverride.api_url;
    apiKey = channelOverride.api_key;
    instanceId = channelOverride.instance_id;
    provider = channelOverride.provider || provider;
    channelSource = 'database';
  }

  // 2. Tentar usar canal padrão configurado no banco
  try {
    if (channelSource !== 'database') {
      const workspace = await getDefaultWorkspaceSettings();
      const channel = await getChannel(workspace.id);
      if (isChannelValid(channel)) {
        // Canal do banco válido: usa as credenciais armazenadas
        apiUrl = channel.api_url;
        apiKey = channel.api_key;
        instanceId = channel.instance_id;
        provider = channel.provider || provider;
        channelSource = 'database';
      }
    }
    // Se canal inválido/incompleto: segue para fallback das env vars (sem lançar erro)
  } catch (err) {
    // Qualquer erro na busca do canal não deve interromper o envio
    console.error('[sendWhatsAppMessage] Erro ao buscar canal do banco — usando env vars como fallback:', err);
  }

  // 3. Fallback: variáveis de ambiente
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

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  console.info('[sendWhatsAppMessage] Status HTTP Wasender:', response.status);

  if (!response.ok) {
    console.error('[sendWhatsAppMessage] Erro retorno provider Wasender:', {
      status: response.status,
      body: data,
      endpoint,
    });
    throw new Error(data?.error || data?.message || 'Falha ao enviar WhatsApp');
  }

  // Retorna result enriquecido com origem do canal (útil para logs futuros)
  return { ...data, channel_source: channelSource, provider, endpoint };
}
