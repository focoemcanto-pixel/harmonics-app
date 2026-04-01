'use client';

export default function AdminSegmentTabs({ items, active, onChange }) {
  return (
    <div className="relative z-0 flex gap-2 overflow-x-auto pb-1 pointer-events-none">
      {items.map((item) => {
        const selected = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`pointer-events-auto whitespace-nowrap rounded-full px-4 py-2 text-[12px] font-black transition ${
              selected
                ? 'bg-violet-100 text-violet-700'
                : 'border border-[#dbe3ef] bg-white text-[#475569]'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
