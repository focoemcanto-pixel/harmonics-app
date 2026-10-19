'use client';

// Cabeçalho de página do admin: título limpo, subtítulo discreto e ações à direita.
// `badge` vira um rótulo pequeno acima do título (as telas antigas usavam "Harmonics Admin").
export default function AdminPageHero({
  badge,
  title,
  subtitle,
  actions,
}) {
  const eyebrow = badge && !/^harmonics admin$/i.test(String(badge).trim()) ? badge : null;

  return (
    <section className="pb-1 pt-1 md:pt-2">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--hx-text-3,#8b93a3)]">{eyebrow}</div>
          ) : null}

          <h1 className="hidden text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] text-[var(--hx-text,#0c0d12)] md:block lg:text-[34px]">
            {title}
          </h1>

          {subtitle ? (
            <p className="mt-1.5 max-w-3xl text-[14px] leading-6 text-[var(--hx-text-2,#586174)] md:text-[15px]">
              {subtitle}
            </p>
          ) : null}
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 [&_a]:rounded-full [&_button]:rounded-full">{actions}</div> : null}
      </div>
    </section>
  );
}
