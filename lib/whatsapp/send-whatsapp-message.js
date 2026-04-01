import { getDefaultWorkspace } from '@/lib/automation/get-workspace';
import { getChannel } from '@/lib/automation/get-channel';

/**
 * Verifica se um canal do banco tem os campos mínimos para envio.
 * Um canal inválido (incompleto) é tratado como inexistente — fallback para env vars.
 */
function isChannelValid(channel) {
  return !!(channel?.api_url && channel?.api_key && channel?.instance_id);
}

/**
 * Envia mensagem via WhatsApp.
 * Ordem de prioridade para credenciais:
 *   1. Canal ativo/padrão do banco de dados (whatsapp_channels)
 *   2. Variáveis de ambiente (WHATSAPP_API_URL, WHATSAPP_API_KEY, WHATSAPP_INSTANCE_ID)
 *
 * A assinatura pública não muda — compatível com todas as chamadas atuais.
 * O resultado inclui `channel_source` ('database' | 'env') para rastreabilidade futura.
 *
 * @param {{ to: string, message: string }} params
 * @returns {Promise<Object>}
 */
export async function sendWhatsAppMessage({ to, message }) {
  let apiUrl;
  let apiKey;
  let instanceId;
  let channelSource = 'env';

  // 1. Tentar usar canal configurado no banco
  try {
    const workspaceId = await getDefaultWorkspace();
    if (workspaceId) {
      const channel = await getChannel(workspaceId);
      if (isChannelValid(channel)) {
        // Canal do banco válido: usa as credenciais armazenadas
        apiUrl = channel.api_url;
        apiKey = channel.api_key;
        instanceId = channel.instance_id;
        channelSource = 'database';
      }
      // Se canal inválido/incompleto: segue para fallback das env vars (sem lançar erro)
    }
  } catch (err) {
    // Qualquer erro na busca do canal não deve interromper o envio
    console.error('[sendWhatsAppMessage] Erro ao buscar canal do banco — usando env vars como fallback:', err);
  }

  // 2. Fallback: variáveis de ambiente
  if (channelSource === 'env') {
    apiUrl = process.env.WHATSAPP_API_URL;
    apiKey = process.env.WHATSAPP_API_KEY;
    instanceId = process.env.WHATSAPP_INSTANCE_ID;
  }

  if (!apiUrl) {
    throw new Error('WHATSAPP_API_URL não configurada');
  }

  // TODO: suporte a múltiplos providers (ex: wasender, evolution, etc.)
  // Por enquanto mantém o formato atual compatível com o provider padrão.
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      instanceId,
      to,
      message,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || data?.message || 'Falha ao enviar WhatsApp');
  }

  // Retorna result enriquecido com origem do canal (útil para logs futuros)
  return { ...data, channel_source: channelSource };
}
