'use client';

import Link from 'next/link';

function itemClass(active) {
  return active
    ? 'bg-violet-100 text-violet-700 shadow-[0_6px_18px_rgba(124,58,237,0.10)]'
    : 'text-[#6b7280]';
}

export default function AdminBottomNav({
  activeItem = 'eventos',
  onOpenMore,
}) {
  const items = [
    { key: 'dashboard', icon: '🏠', label: 'Dashboard', href: '/dashboard' },
    { key: 'eventos', icon: '📅', label: 'Eventos', href: '/eventos' },
    { key: 'contatos', icon: '👤', label: 'Contatos', href: '/contatos' },
    { key: 'contratos', icon: '📝', label: 'Contratos', href: '/contratos' },
    { key: 'mais', icon: '☰', label: 'Mais', href: '' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#e5e7eb] bg-[rgba(244,246,250,0.94)] px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-[0_-10px_30px_rgba(17,24,39,0.06)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-[520px] grid-cols-5 gap-2">
        {items.map((item) => {
          if (item.key === 'mais') {
            return (
              <button
                key={item.key}
                type="button"
                onClick={onOpenMore}
                className={`flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-center transition ${itemClass(
                  activeItem === item.key
                )}`}
              >
                <span className="text-[20px] leading-none">{item.icon}</span>
                <span className="mt-1 text-[11px] font-black">{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-center transition ${itemClass(
                activeItem === item.key
              )}`}
            >
              <span className="text-[20px] leading-none">{item.icon}</span>
              <span className="mt-1 text-[11px] font-black">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
