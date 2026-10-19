'use client';

// Card de métrica: superfície branca, número em destaque e cor apenas no indicador de tom.
const tones = {
  default: { dot: 'bg-[#98a2b3]', value: 'text-[var(--hx-text,#0c0d12)]' },
  success: { dot: 'bg-emerald-500', value: 'text-emerald-700' },
  warning: { dot: 'bg-amber-500', value: 'text-amber-700' },
  accent: { dot: 'bg-violet-500', value: 'text-violet-700' },
};

const sizes = {
  default: { wrapper: 'rounded-[20px] p-5', value: 'text-[26px] md:text-[28px]' },
  highlight: { wrapper: 'rounded-[24px] p-6', value: 'text-[30px] md:text-[34px]' },
};

export default function AdminSummaryCard({
  label,
  value,
  helper,
  tone = 'default',
  size = 'default',
}) {
  const toneClasses = tones[tone] || tones.default;
  const sizeClasses = sizes[size] || sizes.default;

  return (
    <div className={`hx-lift min-w-0 border border-[var(--hx-border,#e4e7ec)] bg-white shadow-[var(--hx-shadow-sm)] ${sizeClasses.wrapper}`}>
      <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--hx-text-2,#586174)]">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneClasses.dot}`} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </div>

      <div className={`mt-3 break-words font-semibold leading-none tracking-[-0.03em] tabular-nums ${toneClasses.value} ${sizeClasses.value}`}>
        {value}
      </div>

      {helper ? (
        <div className="mt-3 text-[12px] leading-5 text-[var(--hx-text-3,#8b93a3)]">
          {helper}
        </div>
      ) : null}
    </div>
  );
}
