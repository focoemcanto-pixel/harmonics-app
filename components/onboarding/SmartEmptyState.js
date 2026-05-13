import Link from 'next/link';

export default function SmartEmptyState({
  eyebrow = 'Primeiro passo',
  title,
  description,
  bullets = [],
  primaryHref,
  primaryLabel = 'Começar agora',
  secondaryHref = '/settings/onboarding',
  secondaryLabel = 'Ver onboarding',
  icon = '🧭',
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-6 text-left shadow-[0_14px_34px_rgba(124,58,237,0.08)]">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-violet-700 ring-1 ring-violet-100">
            <span>{icon}</span>
            <span>{eyebrow}</span>
          </div>

          <h3 className="mt-4 text-[24px] font-black tracking-[-0.04em] text-[#0f172a]">
            {title}
          </h3>

          {description ? (
            <p className="mt-2 max-w-2xl text-[14px] font-semibold leading-7 text-[#64748b]">
              {description}
            </p>
          ) : null}

          {bullets.length > 0 ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {bullets.map((bullet) => (
                <div key={bullet} className="flex items-center gap-2 text-[13px] font-bold text-[#334155]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[11px] text-emerald-700">✓</span>
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
          {primaryHref ? (
            <Link href={primaryHref} className="rounded-2xl bg-violet-600 px-5 py-3 text-center text-sm font-black text-white shadow-[0_14px_28px_rgba(124,58,237,0.22)] transition hover:bg-violet-500">
              {primaryLabel}
            </Link>
          ) : null}

          {secondaryHref ? (
            <Link href={secondaryHref} className="rounded-2xl border border-violet-200 bg-white px-5 py-3 text-center text-sm font-black text-violet-700 transition hover:bg-violet-50">
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
