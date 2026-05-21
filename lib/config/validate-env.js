const REQUIRED_ENV_KEYS = [
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'ASAAS_API_KEY',
  'ASAAS_ENV',
  'NEXT_PUBLIC_APP_URL',
];

export function validateRequiredEnv(context = 'runtime') {
  const missing = REQUIRED_ENV_KEYS.filter((key) => {
    const value = process.env[key];
    return !value || String(value).trim().length === 0;
  });

  if (missing.length > 0) {
    console.error(
      `[ENV_VALIDATION][${context}] Variáveis obrigatórias ausentes: ${missing.join(', ')}`
    );

    return {
      ok: false,
      missing,
    };
  }

  return {
    ok: true,
    missing: [],
  };
}

export function requireRequiredEnv(context = 'runtime') {
  const validation = validateRequiredEnv(context);

  if (!validation.ok) {
    throw new Error(`Variáveis obrigatórias ausentes: ${validation.missing.join(', ')}`);
  }

  return validation;
}

export { REQUIRED_ENV_KEYS };
