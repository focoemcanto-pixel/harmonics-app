'use client';

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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={closeOnOverlay ? (onClose || onCancel) : undefined}
      />

      <div
        className={`relative z-10 flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.25)] sm:h-auto sm:max-h-[92vh] sm:rounded-[28px] ${maxWidthClass} ${panelClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || subtitle) ? (
          <div className="border-b border-slate-200 px-6 py-5">
            {title ? <h2 className="text-[20px] font-black tracking-[-0.02em] text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p> : null}
          </div>
        ) : null}

        <div className={`min-h-0 flex-1 overflow-y-auto px-6 py-5 ${bodyClassName}`}>
          {children}
        </div>

        {!hideDefaultFooter || footer ? (
          <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
            {footer || (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onCancel || onClose}
                  className="rounded-[14px] border border-slate-200 bg-white px-4 py-2 text-[13px] font-black text-slate-700"
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
