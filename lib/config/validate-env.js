const REQUIRED_ENV_KEYS = [
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
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

export { REQUIRED_ENV_KEYS };
