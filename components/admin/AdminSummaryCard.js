'use client';

const tones = {
  default: 'bg-white border-[#dbe3ef] text-[#0f172a]',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  accent: 'bg-violet-50 border-violet-200 text-violet-700',
};

export default function AdminSummaryCard({
  label,
  value,
  helper,
  tone = 'default',
}) {
  return (
    <div
      className={`rounded-[24px] border p-5 shadow-[0_8px_24px_rgba(17,24,39,0.04)] ${tones[tone] || tones.default}`}
    >
      <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] opacity-80">
        {label}
      </div>

      <div className="mt-3 text-[28px] font-black leading-none">{value}</div>

      {helper ? (
        <div className="mt-3 text-[13px] font-semibold opacity-80">{helper}</div>
      ) : null}
    </div>
  );
}