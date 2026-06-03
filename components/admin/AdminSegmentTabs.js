'use client';

export default function AdminSegmentTabs({ items = [], active, onChange }) {
  return (
    <nav
      aria-label="Abas da seção"
      className="relative z-0 -mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const selected = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange?.(item.key)}
            className={`shrink-0 touch-manipulation whitespace-nowrap rounded-full px-4 py-2.5 text-[12px] font-black transition active:scale-[0.98] ${
              selected
                ? 'bg-violet-100 text-violet-700 shadow-[0_8px_18px_rgba(124,58,237,0.12)]'
                : 'border border-[#dbe3ef] bg-white text-[#475569]'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
