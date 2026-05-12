'use client';

import { useState } from 'react';

export default function PaymentProofSignedButton({
  paymentId,
  hasProof = true,
  children = 'Abrir comprovante',
  className = '',
  disabledLabel = 'Pagamento sem comprovante disponível',
  onError,
}) {
  const [opening, setOpening] = useState(false);
  const resolvedPaymentId = String(paymentId || '').trim();
  const disabled = !hasProof || !resolvedPaymentId || opening;

  async function handleOpen() {
    if (disabled) return;

    try {
      setOpening(true);
      const response = await fetch(`/api/payments/${encodeURIComponent(resolvedPaymentId)}/proof-signed-url`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.ok || !payload?.url) {
        throw new Error(payload?.error || 'Não foi possível abrir o comprovante.');
      }

      const anchor = document.createElement('a');
      anchor.href = payload.url;
      anchor.target = '_blank';
      anchor.rel = 'noreferrer noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (error) {
      console.error('[PaymentProofSignedButton][ERROR]', error);
      onError?.(error);
    } finally {
      setOpening(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={disabled}
      title={!resolvedPaymentId || !hasProof ? disabledLabel : ''}
      className={className || 'rounded-xl border border-[#dbe3ef] bg-white px-3 py-2 text-xs font-bold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60'}
    >
      {opening ? 'Abrindo...' : children}
    </button>
  );
}
