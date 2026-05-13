export const WHATSAPP_PROVIDER_REGISTRY = [
  {
    key: 'wasender',
    label: 'Wasender',
    description: 'Gateway simples para disparos WhatsApp.',
    category: 'hosted',
  },
  {
    key: 'evolution',
    label: 'Evolution API',
    description: 'API WhatsApp self-hosted baseada em Baileys.',
    category: 'self_hosted',
  },
  {
    key: 'zapi',
    label: 'Z-API',
    description: 'Integração oficial via Z-API.',
    category: 'hosted',
  },
  {
    key: 'meta_cloud',
    label: 'Meta Cloud API',
    description: 'API oficial do WhatsApp Business da Meta.',
    category: 'official',
  },
  {
    key: 'wppconnect',
    label: 'WPPConnect',
    description: 'Conector baseado em sessão WhatsApp Web.',
    category: 'self_hosted',
  },
  {
    key: 'twilio',
    label: 'Twilio WhatsApp',
    description: 'Integração empresarial via Twilio.',
    category: 'official',
  },
  {
    key: 'ultramsg',
    label: 'UltraMsg',
    description: 'Gateway WhatsApp cloud simplificado.',
    category: 'hosted',
  },
];

export function getWhatsappProvider(providerKey) {
  return WHATSAPP_PROVIDER_REGISTRY.find((provider) => provider.key === providerKey) || null;
}
