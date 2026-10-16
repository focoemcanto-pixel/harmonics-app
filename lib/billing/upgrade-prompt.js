// Bloqueio de plano (402) vindo da API → oferece ir direto à assinatura com o plano sugerido
// destacado. Nunca assina sozinho: só leva o usuário à tela de planos.
const PLAN_BLOCK_CODES = new Set(['PLAN_LIMIT_REACHED', 'PLAN_FEATURE_NOT_INCLUDED']);

export function isPlanBlock(payload) {
  return PLAN_BLOCK_CODES.has(String(payload?.code || ''));
}

export function upgradeHref(suggestedPlan) {
  const slug = String(suggestedPlan?.slug || '').trim();
  return /^[a-z][a-z0-9_]{0,39}$/.test(slug) ? `/settings/billing?plan=${slug}` : '/settings/billing';
}

export async function offerUpgrade({ confirm, router, message, suggestedPlan }) {
  const description = String(message || 'Este recurso não está incluído no seu plano atual.');
  const confirmText = suggestedPlan?.name ? `Ver o plano ${suggestedPlan.name}` : 'Ver planos';
  const accepted = typeof confirm === 'function'
    ? await confirm({ title: 'Disponível em outro plano', description, confirmText, cancelText: 'Agora não' })
    : window.confirm(description);
  if (accepted) router.push(upgradeHref(suggestedPlan));
  return accepted;
}

// Erro de API com o código e o plano sugerido preservados (para o catch decidir entre upgrade e toast).
export function apiError(payload, fallback) {
  const error = new Error(payload?.error || payload?.message || fallback);
  error.code = payload?.code || null;
  error.suggestedPlan = payload?.suggestedPlan || null;
  return error;
}
