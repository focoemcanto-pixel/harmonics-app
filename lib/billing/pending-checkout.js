// Antes de abrir um novo checkout, cancela no Asaas a assinatura do checkout pendente anterior
// (troca de plano antes de pagar, ou checkout antigo expirado). Sem isso o cliente ficaria com
// duas assinaturas gerando cobranças todo mês. Nunca toca na assinatura paga ativa.
export async function cancelSupersededPendingCheckout({ pending, activeProviderSubscriptionId, cancelSubscription }) {
  const pendingId = String(pending?.provider_subscription_id || '').trim();
  if (!pendingId || pendingId === String(activeProviderSubscriptionId || '').trim()) {
    return { ok: true, skipped: true };
  }
  try {
    await cancelSubscription(pendingId);
    return { ok: true, canceled: pendingId };
  } catch (error) {
    // Já removida no Asaas: nada a cancelar.
    if (error?.providerStatus === 404) return { ok: true, alreadyGone: pendingId };
    return { ok: false, error };
  }
}
