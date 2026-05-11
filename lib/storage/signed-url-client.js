export async function fetchContractSignedUrl(contractId, options = {}) {
  const id = String(contractId || '').trim();
  if (!id) throw new Error('contractId é obrigatório.');

  const params = new URLSearchParams();
  if (options.expiresIn) params.set('expiresIn', String(options.expiresIn));

  const response = await fetch(
    `/api/contracts/${encodeURIComponent(id)}/signed-url${params.toString() ? `?${params}` : ''}`,
    {
      method: 'GET',
      credentials: 'include',
    }
  );

  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.ok || !json?.url) {
    throw new Error(json?.error || json?.message || 'Não foi possível gerar o link temporário do contrato.');
  }

  return json;
}

export async function fetchPaymentProofSignedUrl(paymentId, options = {}) {
  const id = String(paymentId || '').trim();
  if (!id) throw new Error('paymentId é obrigatório.');

  const params = new URLSearchParams();
  if (options.expiresIn) params.set('expiresIn', String(options.expiresIn));

  const response = await fetch(
    `/api/payments/${encodeURIComponent(id)}/proof-signed-url${params.toString() ? `?${params}` : ''}`,
    {
      method: 'GET',
      credentials: 'include',
    }
  );

  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.ok || !json?.url) {
    throw new Error(json?.error || json?.message || 'Não foi possível gerar o link temporário do comprovante.');
  }

  return json;
}

export async function openContractSignedUrl(contractId, options = {}) {
  const signed = await fetchContractSignedUrl(contractId, options);
  window.open(signed.url, options.target || '_blank', 'noopener,noreferrer');
  return signed;
}

export async function openPaymentProofSignedUrl(paymentId, options = {}) {
  const signed = await fetchPaymentProofSignedUrl(paymentId, options);
  window.open(signed.url, options.target || '_blank', 'noopener,noreferrer');
  return signed;
}
