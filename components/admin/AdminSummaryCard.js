'use client';

const tones = {
  default:
    'border-[#dbe3ef] bg-white text-[#0f172a]',
  success:
    'border-emerald-200 bg-[linear-gradient(180deg,#f3fcf7_0%,#ecfdf3_100%)] text-emerald-700',
  warning:
    'border-amber-200 bg-[linear-gradient(180deg,#fffaf0_0%,#fffbeb_100%)] text-amber-800',
  accent:
    'border-violet-200 bg-[linear-gradient(180deg,#faf7ff_0%,#f5f3ff_100%)] text-violet-700',
};

const sizes = {
  default: {
    wrapper: 'rounded-[24px] p-5',
    label: 'text-[11px]',
    value: 'text-[28px]',
    helper: 'text-[13px]',
  },
  highlight: {
    wrapper: 'rounded-[28px] p-6',
    label: 'text-[11px]',
    value: 'text-[34px]',
    helper: 'text-[13px]',
  },
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
    <div
      className={`relative overflow-hidden border shadow-[0_10px_28px_rgba(17,24,39,0.05)] ${toneClasses} ${sizeClasses.wrapper}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.55),transparent_36%)]" />

      <div className="relative z-10">
        <div
          className={`${sizeClasses.label} font-black uppercase tracking-[0.1em] opacity-75`}
        >
          {label}
        </div>

        <div className={`mt-4 font-black leading-none tracking-[-0.04em] ${sizeClasses.value}`}>
          {value}
        </div>

        {helper ? (
          <div className={`mt-4 font-semibold leading-5 opacity-80 ${sizeClasses.helper}`}>
            {helper}
          </div>
        ) : null}
      </div>
    </div>
  );
}
