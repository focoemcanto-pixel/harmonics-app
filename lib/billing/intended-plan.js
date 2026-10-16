// Plano escolhido na página pública (/planos) antes do cadastro. Guardado só no navegador do
// visitante e usado para levá-lo à assinatura depois do onboarding. Nunca altera o plano sozinho:
// a troca só acontece pelo checkout + webhook.
const KEY = 'harmonics_intended_plan';

export function normalizePlanSlug(value) {
  const slug = String(value || '').trim().toLowerCase();
  return /^[a-z][a-z0-9_]{0,39}$/.test(slug) && slug !== 'free' ? slug : '';
}

export function saveIntendedPlan(value) {
  const slug = normalizePlanSlug(value);
  if (!slug) return '';
  try {
    window.localStorage.setItem(KEY, slug);
  } catch {}
  return slug;
}

export function readIntendedPlan() {
  try {
    return normalizePlanSlug(window.localStorage.getItem(KEY));
  } catch {
    return '';
  }
}

export function clearIntendedPlan() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}

export function planFromLocation() {
  try {
    return normalizePlanSlug(new URLSearchParams(window.location.search).get('plan'));
  } catch {
    return '';
  }
}
