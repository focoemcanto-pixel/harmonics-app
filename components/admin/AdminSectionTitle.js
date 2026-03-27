'use client';

export default function AdminSectionTitle({ title, subtitle, right }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <div className="text-[22px] font-black text-[#111827]">{title}</div>
        {subtitle ? (
          <div className="mt-1 text-[14px] leading-6 text-[#64748b]">
            {subtitle}
          </div>
        ) : null}
      </div>

      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}