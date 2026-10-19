'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import NavIcon from '@/components/admin/shell/NavIcon';
import { findActiveChild, isPathInItem } from '@/lib/admin/navigation';

// Menu lateral do desktop. Em telas médias (md→lg) ou recolhido vira um trilho só de ícones.
export default function AdminSidebar({ sections = [], workspace, workspaceLoading = false, collapsed = false, onToggleCollapsed, onPrefetch }) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const labelClass = collapsed ? 'hidden' : 'hidden lg:inline';
  const expandedOnly = collapsed ? 'hidden' : 'hidden lg:block';

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut({ redirect: true });
    } finally {
      setLoggingOut(false);
    }
  }

  const workspaceName = workspaceLoading ? 'Carregando…' : workspace?.displayName || 'Workspace';

  return (
    <aside
      className={`sticky top-0 hidden h-[100dvh] shrink-0 flex-col p-3 md:flex ${collapsed ? 'w-[84px]' : 'w-[84px] lg:w-[264px]'}`}
      aria-label="Menu principal"
    >
      <div className="flex min-h-0 flex-1 flex-col rounded-[var(--hx-radius-xl)] border border-[var(--hx-border)] bg-[var(--hx-surface)] shadow-[var(--hx-shadow-sm)]">
        <div className={`flex shrink-0 items-center gap-3 px-3 pb-2 pt-3 ${collapsed ? 'justify-center' : 'justify-center lg:justify-start'}`}>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-[13px] font-bold text-white"
            style={{ background: 'var(--hx-ink)' }}
            title={workspaceName}
          >
            {workspaceLoading ? '…' : workspace?.initials || 'H'}
          </div>
          <div className={`min-w-0 flex-1 ${expandedOnly}`}>
            <div className="truncate text-[14px] font-semibold text-[var(--hx-text)]">{workspaceName}</div>
            <div className="text-[12px] text-[var(--hx-text-3)]">Harmonics · Admin</div>
          </div>
        </div>

        <nav className="hx-sidebar-scroll mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2 [scrollbar-width:thin]">
          {sections.map((section) => (
            <div key={section.key} className="mt-3 first:mt-1">
              <div className={`px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--hx-text-3)] ${expandedOnly}`}>
                {section.label}
              </div>
              <div className={`mx-auto mb-2 h-px w-8 bg-[var(--hx-border)] first:hidden ${collapsed ? 'block' : 'block lg:hidden'}`} aria-hidden="true" />
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isPathInItem(pathname, item);
                  const activeChild = active ? findActiveChild(pathname, item) : null;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        prefetch={false}
                        title={item.label}
                        aria-current={active ? 'page' : undefined}
                        onPointerEnter={() => onPrefetch?.(item.href)}
                        onFocus={() => onPrefetch?.(item.href)}
                        className={`group flex min-h-10 items-center gap-3 rounded-[12px] px-3 py-2 text-[14px] font-medium transition-colors ${
                          collapsed ? 'justify-center' : 'justify-center lg:justify-start'
                        } ${
                          active
                            ? 'bg-[var(--hx-ink)] text-[var(--hx-ink-contrast)]'
                            : 'text-[var(--hx-text-2)] hover:bg-[var(--hx-surface-2)] hover:text-[var(--hx-text)]'
                        }`}
                      >
                        <NavIcon name={item.icon} className="shrink-0" />
                        <span className={`truncate ${labelClass}`}>{item.label}</span>
                      </Link>

                      {active && item.children?.length > 1 ? (
                        <ul className={`mb-1 ml-[26px] mt-1 space-y-0.5 border-l border-[var(--hx-border)] pl-3 ${expandedOnly}`}>
                          {item.children.map((child) => {
                            const childActive = activeChild ? activeChild.href === child.href : pathname === child.href;
                            return (
                              <li key={child.href}>
                                <Link
                                  href={child.href}
                                  prefetch={false}
                                  onPointerEnter={() => onPrefetch?.(child.href)}
                                  aria-current={childActive ? 'page' : undefined}
                                  className={`block rounded-[10px] px-3 py-1.5 text-[13px] transition-colors ${
                                    childActive
                                      ? 'bg-[var(--hx-surface-3)] font-semibold text-[var(--hx-text)]'
                                      : 'text-[var(--hx-text-2)] hover:text-[var(--hx-text)]'
                                  }`}
                                >
                                  {child.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 space-y-1 border-t border-[var(--hx-border)] p-2">
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className={`hidden min-h-10 w-full items-center gap-3 rounded-[12px] px-3 text-[13px] font-medium text-[var(--hx-text-2)] transition-colors hover:bg-[var(--hx-surface-2)] hover:text-[var(--hx-text)] lg:flex ${collapsed ? 'justify-center' : ''}`}
          >
            {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.9} /> : <PanelLeftClose size={18} strokeWidth={1.9} />}
            <span className={labelClass}>Recolher menu</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            title="Sair da conta"
            className={`flex min-h-10 w-full items-center gap-3 rounded-[12px] px-3 text-[13px] font-medium text-[var(--hx-text-2)] transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-60 ${collapsed ? 'justify-center' : 'justify-center lg:justify-start'}`}
          >
            <LogOut size={18} strokeWidth={1.9} />
            <span className={labelClass}>{loggingOut ? 'Encerrando…' : 'Sair da conta'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

