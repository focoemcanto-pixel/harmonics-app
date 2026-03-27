export default function Card({
  children,
  className = '',
  title,
  subtitle,
  actions,
}) {
  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white/95 shadow-sm ${className}`}
    >
      {(title || subtitle || actions) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 md:px-6">
          <div>
            {title && (
              <h3 className="text-lg md:text-xl font-semibold text-slate-900">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
            )}
          </div>

          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}

      <div className="px-5 pb-5 md:px-6 md:pb-6">{children}</div>
    </div>
  );
}