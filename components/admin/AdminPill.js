'use client';

function getToneClasses(tone) {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-100 text-emerald-700';
    case 'amber':
      return 'bg-amber-100 text-amber-800';
    case 'red':
      return 'bg-red-100 text-red-700';
    case 'violet':
      return 'bg-violet-100 text-violet-700';
    case 'blue':
      return 'bg-sky-100 text-sky-700';
    case 'slate':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export default function AdminPill({ tone = 'default', children }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${getToneClasses(
        tone
      )}`}
    >
      {children}
    </span>
  );
}
