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
  let channelSource = 'env';

  // 1. Canal explicitamente resolvido pela regra (quando informado)
  if (isChannelValid(channelOverride)) {
    apiUrl = channelOverride.api_url;
    apiKey = channelOverride.api_key;
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
  }

  if (!apiUrl) {
    throw new Error('WHATSAPP_API_URL não configurada');
  }

  const endpoint = resolveWasenderSendMessageUrl(apiUrl);
  const payload = {
    to,
    text: message,
  };

  console.info('[sendWhatsAppMessage] Endpoint final Wasender:', endpoint);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
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
  return { ...data, channel_source: channelSource };
}
