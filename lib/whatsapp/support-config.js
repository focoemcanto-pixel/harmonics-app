export const DEFAULT_SUPPORT_WHATSAPP_NUMBER = '5571999375574';
export const DEFAULT_SUPPORT_WHATSAPP_MESSAGE = 'Olá, preciso de ajuda com meu evento.';

function normalizeWhatsappPhone(phone = '') {
  return String(phone || '').replace(/\D/g, '');
}

function normalizeWhatsappMessage(message = '') {
  return String(message || '').trim();
}

export function buildWhatsAppUrl(phone, message = '') {
  const normalizedPhone = normalizeWhatsappPhone(phone);
  if (!normalizedPhone) return '#';

  const normalizedMessage = normalizeWhatsappMessage(message);
  if (!normalizedMessage) return `https://wa.me/${normalizedPhone}`;

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(normalizedMessage)}`;
}

export function resolveSupportWhatsAppConfig(settings = null) {
  const phone = normalizeWhatsappPhone(
    settings?.support_whatsapp_number || DEFAULT_SUPPORT_WHATSAPP_NUMBER
  );
  const message = normalizeWhatsappMessage(
    settings?.support_whatsapp_message || DEFAULT_SUPPORT_WHATSAPP_MESSAGE
  );

  return {
    phone,
    message,
  };
}
