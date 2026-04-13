function normalizeProvider(provider) {
  return String(provider || 'wasender').trim().toLowerCase();
}

export function validateChannelConfig(channel) {
  const provider = normalizeProvider(channel?.provider);
  const apiUrl = String(channel?.api_url || '').trim();
  const apiKey = String(channel?.api_key || '').trim();
  const instanceId = String(channel?.instance_id || '').trim();

  const missing = [];

  if (!apiUrl) missing.push('api_url');
  if (!apiKey) missing.push('api_key');

  // Providers baseados em sessão geralmente exigem instance_id.
  const needsInstanceId = provider === 'wasender' || provider === 'evolution-api' || provider === 'other';
  if (needsInstanceId && !instanceId) {
    missing.push('instance_id');
  }

  return {
    provider,
    missing,
    isValid: missing.length === 0,
  };
}

export { normalizeProvider };
