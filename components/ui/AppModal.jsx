'use client';

export default function AppModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidthClass = 'max-w-2xl',
  bodyClassName = '',
  panelClassName = '',
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />

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

        {footer ? (
          <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
