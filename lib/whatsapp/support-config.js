export const DEFAULT_SUPPORT_WHATSAPP_NUMBER = '5571999375574';
export const DEFAULT_SUPPORT_WHATSAPP_MESSAGE = 'Olá, preciso de ajuda com meu evento.';

export function buildWhatsAppUrl(phone, message = '') {
  const normalizedPhone = String(phone || '').replace(/\D/g, '');
  if (!normalizedPhone) return '#';

  if (!message) return `https://wa.me/${normalizedPhone}`;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function resolveSupportWhatsAppConfig(settings = null) {
  return {
    phone: settings?.support_whatsapp_number || DEFAULT_SUPPORT_WHATSAPP_NUMBER,
    message: settings?.support_whatsapp_message || DEFAULT_SUPPORT_WHATSAPP_MESSAGE,
  };
}
