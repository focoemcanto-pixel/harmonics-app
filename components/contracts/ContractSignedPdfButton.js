'use client';

import { useState } from 'react';

export default function ContractSignedPdfButton({
  contractId,
  hasPdf = true,
  children = 'PDF final',
  className = '',
  disabledLabel = 'Contrato sem PDF disponível',
  onError,
}) {
  const [opening, setOpening] = useState(false);
  const resolvedContractId = String(contractId || '').trim();
  const disabled = !hasPdf || !resolvedContractId || opening;

  async function handleOpen() {
    if (disabled) return;

    try {
      setOpening(true);
      const response = await fetch(`/api/contracts/${encodeURIComponent(resolvedContractId)}/signed-url`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.ok || !payload?.url) {
        throw new Error(payload?.error || 'Não foi possível abrir o PDF do contrato.');
      }

      const anchor = document.createElement('a');
      anchor.href = payload.url;
      anchor.target = '_blank';
      anchor.rel = 'noreferrer noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (error) {
      console.error('[ContractSignedPdfButton][ERROR]', error);
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
      aria-busy={opening ? 'true' : undefined}
      title={!resolvedContractId || !hasPdf ? disabledLabel : ''}
      className={className || 'inline-flex min-h-11 touch-manipulation items-center justify-center rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-center text-[14px] font-black text-[#0f172a] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100'}
    >
      {opening ? 'Abrindo PDF...' : children}
    </button>
  );
}
