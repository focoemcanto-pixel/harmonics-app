'use client';

import { useState } from 'react';
import { openPaymentProofSignedUrl } from '@/lib/storage/signed-url-client';

export default function SignedPaymentProofButton({
  paymentId,
  children = 'Abrir comprovante',
  className = '',
  disabled = false,
  expiresIn = 60 * 30,
  onError,
  onOpened,
}) {
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    const id = String(paymentId || '').trim();
    if (!id || loading || disabled) return;

    try {
      setLoading(true);
      const signed = await openPaymentProofSignedUrl(id, { expiresIn });
      if (typeof onOpened === 'function') onOpened(signed);
    } catch (error) {
      if (typeof onError === 'function') {
        onError(error);
      } else {
        console.error('[SIGNED_PAYMENT_PROOF_BUTTON][ERROR]', error);
        alert(error?.message || 'Não foi possível abrir o comprovante.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={disabled || loading || !paymentId}
      className={className || 'rounded-[14px] border border-[#dbe3ef] bg-white px-3 py-2 text-[12px] font-black text-[#0f172a] disabled:cursor-not-allowed disabled:opacity-60'}
    >
      {loading ? 'Gerando link...' : children}
    </button>
  );
}
