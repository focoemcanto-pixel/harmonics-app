'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Ellipsis } from 'lucide-react';
import NavIcon from '@/components/admin/shell/NavIcon';
import { isPathInItem } from '@/lib/admin/navigation';

// Barra inferior do celular/PWA: atalhos principais + "Mais" (todos os módulos permitidos).
export default function AdminBottomNav({ items = [], onOpenMore, moreActive = false, onPrefetch }) {
  const pathname = usePathname();
  const anyPrimaryActive = items.some((item) => isPathInItem(pathname, item));

  const itemClass = (active) =>
    `flex min-h-[52px] flex-1 touch-manipulation flex-col items-center justify-center gap-1 rounded-[16px] text-[11px] font-medium transition active:scale-[0.97] ${
      active ? 'text-[var(--hx-text)]' : 'text-[var(--hx-text-3)]'
    }`;

  const iconWrap = (active) =>
    `flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? 'bg-[var(--hx-ink)] text-[var(--hx-ink-contrast)]' : ''}`;

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-[85] border-t border-[var(--hx-border)] bg-[color-mix(in_srgb,var(--hx-surface)_94%,transparent)] px-2 pb-[env(safe-area-inset-bottom,0px)] pt-1.5 backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch gap-1">
        {items.map((item) => {
          const active = isPathInItem(pathname, item);
          return (
            <Link
              key={item.key}
              href={item.href}
              prefetch={false}
              onTouchStart={() => onPrefetch?.(item.href)}
              aria-current={active ? 'page' : undefined}
              className={itemClass(active)}
            >
              <span className={iconWrap(active)}>
                <NavIcon name={item.icon} size={18} />
              </span>
              <span className="max-w-full truncate px-1">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          data-onboarding-tour="mobile-more"
          aria-label="Abrir todos os módulos"
          onClick={onOpenMore}
          className={itemClass(moreActive || !anyPrimaryActive)}
        >
          <span className={iconWrap(moreActive || !anyPrimaryActive)}>
            <Ellipsis size={18} aria-hidden="true" />
          </span>
          <span>Mais</span>
        </button>
      </div>
    </nav>
  );
}
