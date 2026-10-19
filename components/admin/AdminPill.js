'use client';

function getToneClasses(tone) {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/15';
    case 'amber':
      return 'bg-amber-50 text-amber-800 ring-amber-600/20';
    case 'red':
      return 'bg-red-50 text-red-700 ring-red-600/15';
    case 'violet':
      return 'bg-violet-50 text-violet-700 ring-violet-600/15';
    case 'blue':
      return 'bg-sky-50 text-sky-700 ring-sky-600/15';
    default:
      return 'bg-[#f2f4f7] text-[#475467] ring-[#475467]/10';
  }
}

export default function AdminPill({ tone = 'default', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${getToneClasses(tone)}`}
    >
      {children}
    </span>
  );
}
