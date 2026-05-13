'use client';

import Link from 'next/link';
import useCurrentWorkspace from '@/hooks/useCurrentWorkspace';

const PRIMARY_ITEMS = [
  { key: 'dashboard', module: 'dashboard', icon: '🏠', label: 'Dashboard', href: '/dashboard' },
  { key: 'eventos', module: 'eventos', icon: '📅', label: 'Eventos', href: '/eventos' },
  { key: 'contatos', module: 'contatos', icon: '👤', label: 'Contatos', href: '/contatos' },
  { key: 'contratos', module: 'contratos', icon: '📝', label: 'Contratos', href: '/contratos' },
];

const MORE_ITEM = { key: 'mais', module: 'mais', icon: '☰', label: 'Mais' };

function NavItem({ item, active, onOpenMore }) {
  const { workspace } = useCurrentWorkspace();
  const primaryColor = workspace?.primaryColor || '#7c3aed';

  const activeStyle = active
    ? {
        background: `${primaryColor}18`,
        color: primaryColor,
        boxShadow: `0 6px 18px ${primaryColor}22`,
      }
    : {
        color: '#6b7280',
      };

  const content = (
    <>
      <span className="text-[20px] leading-none">{item.icon}</span>
      <span className="mt-1 text-[11px] font-black">{item.label}</span>
    </>
  );

  if (item.key === 'mais') {
    return (
      <button
        type="button"
        data-onboarding-tour="mobile-more"
        aria-label="Abrir mais opções"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpenMore?.();
        }}
        onTouchEnd={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpenMore?.();
        }}
        className="touch-manipulation pointer-events-auto flex min-h-[56px] flex-col items-center justify-center rounded-2xl px-2 py-2 text-center transition active:scale-[0.98]"
        style={activeStyle}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      className="touch-manipulation flex min-h-[56px] flex-col items-center justify-center rounded-2xl px-2 py-2 text-center transition active:scale-[0.98]"
      style={activeStyle}
    >
      {content}
    </Link>
  );
}

export default function AdminBottomNav({ activeItem = 'eventos', onOpenMore, allowedModules = null }) {
  const allowed = allowedModules instanceof Set ? allowedModules : null;

  const visiblePrimaryItems = allowed ? PRIMARY_ITEMS.filter((item) => allowed.has(item.module)) : PRIMARY_ITEMS;
  const items = [...visiblePrimaryItems.slice(0, 4), MORE_ITEM];
  const columnsClass = items.length === 5 ? 'grid-cols-5' : items.length === 4 ? 'grid-cols-4' : items.length === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[80] border-t border-[#e5e7eb] bg-[rgba(244,246,250,0.96)] px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-[0_-10px_30px_rgba(17,24,39,0.06)] backdrop-blur-xl">
      <div className={`mx-auto grid max-w-[520px] ${columnsClass} gap-2`}>
        {items.map((item) => (
          <NavItem key={item.key} item={item} active={activeItem === item.key} onOpenMore={onOpenMore} />
        ))}
      </div>
    </nav>
  );
}
