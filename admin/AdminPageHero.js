'use client';

export default function AdminPageHero({
  badge,
  title,
  subtitle,
  actions,
}) {
  return (
    <section className="rounded-[30px] border border-[#dbe3ef] bg-white p-6 shadow-[0_12px_30px_rgba(17,24,39,0.05)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          {badge ? (
            <div className="text-[14px] font-bold text-violet-600">{badge}</div>
          ) : null}

          <div className="mt-2 text-[42px] font-black leading-tight text-[#0f172a]">
            {title}
          </div>

          {subtitle ? (
            <div className="mt-2 text-[16px] leading-7 text-[#64748b]">
              {subtitle}
            </div>
          ) : null}
        </div>

        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </section>
  );
}