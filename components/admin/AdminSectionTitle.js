'use client';

export default function AdminSectionTitle({ title, subtitle, right }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--hx-text,#0c0d12)] md:text-[20px]">{title}</h2>
        {subtitle ? (
          <div className="mt-1 text-[13px] leading-6 text-[var(--hx-text-2,#586174)] md:text-[14px]">
            {subtitle}
          </div>
        ) : null}
      </div>

      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
