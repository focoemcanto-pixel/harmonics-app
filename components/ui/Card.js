export default function Card({
  children,
  className = '',
  title,
  subtitle,
  actions,
}) {
  return (
    <div
      className={`rounded-[20px] border border-[#e4e7ec] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}
    >
      {(title || subtitle || actions) && (
        <div className="flex flex-col gap-3 px-5 pt-5 pb-3 md:flex-row md:items-start md:justify-between md:gap-4 md:px-6">
          <div>
            {title && (
              <h3 className="text-[17px] md:text-[19px] font-semibold tracking-[-0.02em] text-slate-900">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
            )}
          </div>

          {actions && <div className="w-full md:w-auto md:shrink-0">{actions}</div>}
        </div>
      )}

      <div className="px-5 pb-5 md:px-6 md:pb-6">{children}</div>
    </div>
  );
}