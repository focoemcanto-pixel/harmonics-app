'use client';

import { memo, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LogOut, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import NavIcon from '@/components/admin/shell/NavIcon';
import { getInitials, normalizeRoleLabel } from '@/components/admin/shell/userDisplay';
import { isPathInItem } from '@/lib/admin/navigation';

// Folha "Mais" do celular: todos os módulos permitidos, agrupados, + conta e saída.
const MobileMoreSheet = memo(function MobileMoreSheet({ open, onClose, onNavigate, onPrefetch, visibleSections = [], workspaceRole }) {
  const { signOut, profile } = useAuth();
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const isBusy = isLoggingOut || isNavigating;

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyTouchAction = document.body.style.touchAction;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.touchAction = previousBodyTouchAction;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setIsNavigating(false);
      return undefined;
    }

    function handleEscape(event) {
      if (event.key === 'Escape' && !isBusy) onClose?.();
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isBusy, open, onClose]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;

    const hrefs = visibleSections.flatMap((section) => section.items.map((item) => item.href)).filter(Boolean);
    const timer = window.setTimeout(() => {
      hrefs.forEach((href) => onPrefetch?.(href));
    }, 120);

    return () => window.clearTimeout(timer);
  }, [open, onPrefetch, visibleSections]);

  if (!open) return null;

  async function handleLogout() {
    if (isBusy) return;
    setIsLoggingOut(true);
    try {
      await signOut({ redirect: true });
      onClose?.();
    } finally {
      setIsLoggingOut(false);
    }
  }

  function handleNavigate(href) {
    if (isBusy) return;
    onPrefetch?.(href);
    setIsNavigating(true);
    onNavigate?.(href);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Todos os módulos"
      className="fixed inset-0 z-[190] bg-black/40 backdrop-blur-sm md:hidden"
      onClick={(e) => e.target === e.currentTarget && !isBusy && onClose?.()}
    >
      <div
        className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px] bg-[var(--hx-surface)] shadow-[var(--hx-shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 justify-center pt-2.5" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-[var(--hx-surface-3)]" />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-2">
          <div className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--hx-text)]">Todos os módulos</div>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => !isBusy && onClose?.()}
            disabled={isBusy}
            className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-[var(--hx-surface-2)] text-[var(--hx-text)] active:scale-[0.97] disabled:opacity-60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 [-webkit-overflow-scrolling:touch]">
          {visibleSections.map((section) => {
            const entries = section.items.flatMap((item) => {
              const extra = (item.children || []).filter((child) => child.href !== item.href).map((child) => ({ ...child, icon: item.icon, key: child.href, helper: item.label }));
              return [item, ...extra];
            });
            return (
              <section key={section.key} className="mb-4">
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--hx-text-3)]">{section.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {entries.map((item) => {
                    const active = item.children ? isPathInItem(pathname, item) : pathname === item.href;
                    return (
                      <button
                        key={item.key || item.href}
                        type="button"
                        onClick={() => handleNavigate(item.href)}
                        onFocus={() => onPrefetch?.(item.href)}
                        disabled={isBusy}
                        className={`flex min-h-[64px] touch-manipulation flex-col items-start justify-center gap-1 rounded-[18px] border px-3 py-2.5 text-left transition active:scale-[0.98] disabled:opacity-60 ${
                          active ? 'border-[var(--hx-ink)] bg-[var(--hx-ink)] text-white' : 'border-[var(--hx-border)] bg-[var(--hx-surface-2)] text-[var(--hx-text)]'
                        }`}
                      >
                        <NavIcon name={item.icon} size={17} />
                        <span className="w-full truncate text-[13px] font-semibold">{item.label}</span>
                        {item.helper ? <span className={`w-full truncate text-[11px] ${active ? 'text-white/70' : 'text-[var(--hx-text-3)]'}`}>{item.helper}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-[var(--hx-border)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-3">
          {profile ? (
            <div className="mb-2 flex items-center gap-3 px-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--hx-accent-soft)] text-[12px] font-semibold text-[var(--hx-accent-strong)]">
                {getInitials(profile.name || profile.email)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-[var(--hx-text)]">{profile.name || profile.email}</p>
                <p className="truncate text-[12px] text-[var(--hx-text-3)]">{profile.email} · {normalizeRoleLabel(workspaceRole || profile.role)}</p>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleLogout}
            disabled={isBusy}
            className="flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-[16px] border border-[var(--hx-border)] text-[14px] font-semibold text-[var(--hx-text-2)] transition active:scale-[0.99] disabled:opacity-60"
          >
            <LogOut size={16} aria-hidden="true" />
            {isLoggingOut ? 'Encerrando sessão…' : isNavigating ? 'Abrindo…' : 'Sair da conta'}
          </button>
        </div>
      </div>
    </div>
  );
});

export default MobileMoreSheet;
