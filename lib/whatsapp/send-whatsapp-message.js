export async function sendWhatsAppMessage({ to, message }) {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiKey = process.env.WHATSAPP_API_KEY;
  const instanceId = process.env.WHATSAPP_INSTANCE_ID;

  if (!apiUrl) {
    throw new Error('WHATSAPP_API_URL não configurada');
  }

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

  return data;
}
