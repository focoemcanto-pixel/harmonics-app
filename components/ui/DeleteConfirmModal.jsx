'use client';

import { useEffect } from 'react';

export default function DeleteConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  loading = false,
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[170] flex items-end justify-center bg-[#020617]/45 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-[calc(env(safe-area-inset-top,0px)+16px)] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel?.();
      }}
    >
      <div
        className="max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-32px))] w-full max-w-xl overflow-y-auto overscroll-contain rounded-[24px] border border-[#e2e8f0] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.24)] sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#ef4444]">
          Confirmar exclusão
        </p>
        <h3 className="mt-2 text-[22px] font-black leading-tight text-[#0f172a] sm:text-[24px]">{title}</h3>
        <p className="mt-2 text-[14px] leading-6 text-[#475569]">{description}</p>
        <p className="mt-1 text-[14px] font-semibold text-[#ef4444]">Essa ação é definitiva.</p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="min-h-11 touch-manipulation rounded-[14px] border border-[#dbe3ef] bg-white px-4 py-2 text-[13px] font-black text-[#0f172a] disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="min-h-11 touch-manipulation rounded-[14px] bg-red-600 px-4 py-2 text-[13px] font-black text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Excluindo...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
