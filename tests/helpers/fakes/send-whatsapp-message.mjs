// Provider falso: registra a mensagem e devolve um ID; nunca chama a rede.
export async function sendWhatsAppMessage({ to, message, channel = null }) {
  const sent = (globalThis.__WHATSAPP_SENT__ ||= []);
  const behavior = globalThis.__WHATSAPP_BEHAVIOR__;
  if (typeof behavior === 'function') {
    const outcome = await behavior({ to, message, channel, attempt: sent.length + 1 });
    if (outcome instanceof Error) throw outcome;
  }
  sent.push({ to, message, channelId: channel?.id || null });
  return { ok: true, data: { msgId: `fake-msg-${sent.length}` } };
}
