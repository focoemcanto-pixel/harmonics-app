const IS_PROD = process.env.NODE_ENV === 'production';

function normalizeError(error) {
  if (!error) return { message: 'Erro desconhecido' };
  if (typeof error === 'string') return { message: error };

  return {
    message: error.message || 'Erro sem mensagem',
    code: error.code,
    details: error.details,
    hint: error.hint,
  };
}

export function logDebug(scope, message, meta) {
  if (IS_PROD) return;
  if (meta !== undefined) {
    console.info(`[${scope}] ${message}`, meta);
    return;
  }
  console.info(`[${scope}] ${message}`);
}

export function logWarn(scope, message, meta) {
  if (IS_PROD) return;
  if (meta !== undefined) {
    console.warn(`[${scope}] ${message}`, meta);
    return;
  }
  console.warn(`[${scope}] ${message}`);
}

export function reportError(scope, error, context = {}) {
  const normalizedError = normalizeError(error);
  console.error(`[${scope}]`, {
    ...context,
    ...normalizedError,
  });
}
