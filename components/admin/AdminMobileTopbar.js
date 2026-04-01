'use client';

export default function AdminMobileTopbar({ title, actions, subtitle }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#e5e7eb] bg-[rgba(244,246,250,0.94)] px-4 py-3 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
            Harmonics Admin
          </div>
          <div className="mt-1 truncate text-[20px] font-black text-[#111827]">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-1 truncate text-[12px] font-semibold text-[#64748b]">
              {subtitle}
            </div>
          ) : null}
        </div>

        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}
