'use client';

import { useEffect } from 'react';

export default function AppModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  cancelLabel = 'Cancelar',
  onCancel,
  secondaryAction = null,
  primaryAction = null,
  hideDefaultFooter = true,
  closeOnOverlay = true,
  maxWidthClass = 'max-w-2xl',
  bodyClassName = '',
  panelClassName = '',
}) {
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyTouchAction = document.body.style.touchAction;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.touchAction = previousBodyTouchAction;
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        (onClose || onCancel)?.();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[170] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={closeOnOverlay ? (onClose || onCancel) : undefined}
      />

      <div
        className={`relative z-10 flex h-[min(92dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)))] w-full flex-col overflow-hidden rounded-t-[28px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.25)] sm:h-auto sm:max-h-[92vh] sm:rounded-[28px] ${maxWidthClass} ${panelClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || subtitle) ? (
          <div className="shrink-0 border-b border-slate-200 px-5 pb-4 pt-[calc(env(safe-area-inset-top,0px)+20px)] sm:px-6 sm:py-5">
            {title ? <h2 className="break-words text-[20px] font-black tracking-[-0.02em] text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="mt-1 break-words text-[13px] text-slate-500">{subtitle}</p> : null}
          </div>
        ) : null}

        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 [-webkit-overflow-scrolling:touch] sm:px-6 ${bodyClassName}`}>
          {children}
        </div>

        {!hideDefaultFooter || footer ? (
          <div className="sticky bottom-0 shrink-0 border-t border-slate-200 bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-4 backdrop-blur sm:px-6 sm:py-4">
            {footer || (
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onCancel || onClose}
                  className="min-h-11 touch-manipulation rounded-[14px] border border-slate-200 bg-white px-4 py-2 text-[13px] font-black text-slate-700 active:scale-[0.98]"
                >
                  {cancelLabel}
                </button>

                {secondaryAction}
                {primaryAction}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
