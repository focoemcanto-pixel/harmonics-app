'use client';

import Link from 'next/link';

export default function OperationalEmptyState({
  badge = 'Onboarding',
  title,
  description,
  primaryAction,
  secondaryAction,
  tips = [],
  tourKey,
}) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-violet-200 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.14),transparent_34%),linear-gradient(180deg,#ffffff_0%,#faf7ff_100%)] p-6 shadow-[0_20px_60px_rgba(124,58,237,0.10)] md:p-8">
      <div className="absolute right-0 top-0 h-52 w-52 translate-x-1/3 -translate-y-1/3 rounded-full bg-violet-200/30 blur-3xl" />

      <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-center">
        <div>
          <div className="inline-flex rounded-full border border-violet-200 bg-violet-100/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
            {badge}
          </div>

          <h2 className="mt-4 text-[30px] font-black tracking-[-0.05em] text-[#111827] md:text-[38px]">
            {title}
          </h2>

          <p className="mt-3 max-w-2xl text-[15px] font-semibold leading-7 text-[#64748b]">
            {description}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {primaryAction ? (
              <Link
                href={primaryAction.href}
                data-onboarding-tour={tourKey}
                className="rounded-[22px] bg-violet-600 px-5 py-3 text-[14px] font-black text-white shadow-[0_14px_34px_rgba(124,58,237,0.28)] transition hover:-translate-y-0.5 hover:bg-violet-500"
              >
                {primaryAction.label}
              </Link>
            ) : null}

            {secondaryAction ? (
              <Link
                href={secondaryAction.href}
                className="rounded-[22px] border border-violet-200 bg-white px-5 py-3 text-[14px] font-black text-violet-700 transition hover:bg-violet-50"
              >
                {secondaryAction.label}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="rounded-[28px] border border-violet-200 bg-white/90 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur">
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
            Próximos passos
          </div>

          <div className="mt-4 space-y-3">
            {tips.map((tip, index) => (
              <div key={`${tip}-${index}`} className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50/50 px-4 py-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-black text-white">
                  {index + 1}
                </div>
                <div className="text-[13px] font-semibold leading-6 text-[#475569]">
                  {tip}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
