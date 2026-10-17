// Acesso de WhatsApp pelo plano, separando bloqueio real de falha técnica da consulta.
// - Plano sem o recurso ou cota estourada (resposta válida do billing) → bloqueia (fail-closed).
// - Erro ao consultar o plano/uso (banco indisponível etc.) → libera e registra (fail-open),
//   mesma regra de checkPlanLimit/checkPlanFeature: uma falha transitória não derruba a operação.
export async function evaluateWhatsappPlanAccess({ checkFeature, checkLimit }) {
  const technical = (error, code = null) => ({
    allowed: true,
    technicalFailure: true,
    error: String(error?.message || error || 'Falha ao consultar o plano.'),
    code,
  });

  let feature;
  try {
    feature = await checkFeature();
  } catch (error) {
    return technical(error);
  }
  if (!feature || feature.ok === false) return technical(feature?.error, feature?.code || null);
  if (feature.allowed === false) {
    return { allowed: false, technicalFailure: false, error: feature.error || null, code: feature.code || 'FEATURE_NOT_ALLOWED', feature };
  }

  let limit;
  try {
    limit = await checkLimit();
  } catch (error) {
    return technical(error);
  }
  if (!limit || limit.ok === false) return technical(limit?.error, limit?.code || null);
  if (limit.allowed === false) {
    return { allowed: false, technicalFailure: false, error: limit.error || null, code: limit.code || 'PLAN_LIMIT_REACHED', feature, limit };
  }

  return { allowed: true, technicalFailure: false, feature, limit };
}
