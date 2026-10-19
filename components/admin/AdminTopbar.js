'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, LogOut, Search, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getInitials, normalizeRoleLabel } from '@/components/admin/shell/userDisplay';

// Topo do desktop: trilha (seção › tela), busca rápida (⌘K) e menu do usuário.
export default function AdminTopbar({ sectionLabel, title, childLabel, onOpenSearch, role, workspaceName }) {
  const { profile, user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef(null);
  const name = profile?.name || user?.user_metadata?.name || profile?.email || user?.email || 'Usuário';
  const email = profile?.email || user?.email || '';

  useEffect(() => {
    if (!menuOpen) return undefined;
    function handlePointer(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    }
    function handleKey(event) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    window.addEventListener('pointerdown', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('pointerdown', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut({ redirect: true });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-[60] hidden bg-[color-mix(in_srgb,var(--hx-canvas)_86%,transparent)] backdrop-blur-xl md:block">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-4 px-6 lg:px-8">
        <nav aria-label="Você está em" className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-[var(--hx-text-3)]">
          {sectionLabel ? <span className="hidden truncate lg:inline">{sectionLabel}</span> : null}
          {sectionLabel ? <ChevronRight size={14} className="hidden shrink-0 lg:inline" aria-hidden="true" /> : null}
          <span className={`truncate ${childLabel ? '' : 'font-semibold text-[var(--hx-text)]'}`}>{title}</span>
          {childLabel ? (
            <>
              <ChevronRight size={14} className="shrink-0" aria-hidden="true" />
              <span className="truncate font-semibold text-[var(--hx-text)]">{childLabel}</span>
            </>
          ) : null}
        </nav>

        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-10 w-[260px] items-center gap-2 rounded-full border border-[var(--hx-border)] bg-[var(--hx-surface)] px-4 text-[13px] text-[var(--hx-text-3)] shadow-[var(--hx-shadow-sm)] transition hover:border-[var(--hx-border-strong)] xl:w-[320px]"
          aria-label="Buscar tela (atalho Ctrl+K)"
        >
          <Search size={16} aria-hidden="true" />
          <span className="flex-1 text-left">Ir para…</span>
          <kbd className="rounded-md border border-[var(--hx-border)] bg-[var(--hx-surface-2)] px-1.5 py-0.5 font-sans text-[11px] text-[var(--hx-text-3)]">Ctrl K</kbd>
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex h-10 items-center gap-2.5 rounded-full border border-[var(--hx-border)] bg-[var(--hx-surface)] py-1 pl-1 pr-3 shadow-[var(--hx-shadow-sm)] transition hover:border-[var(--hx-border-strong)]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--hx-accent-soft)] text-[12px] font-semibold text-[var(--hx-accent-strong)]">
              {getInitials(name)}
            </span>
            <span className="hidden max-w-[180px] text-left leading-tight xl:block">
              <span className="block truncate text-[13px] font-semibold text-[var(--hx-text)]">{name}</span>
              <span className="block truncate text-[11px] text-[var(--hx-text-3)]">{email}</span>
            </span>
            <ChevronDown size={15} className="text-[var(--hx-text-3)]" aria-hidden="true" />
          </button>

          {menuOpen ? (
            <div role="menu" className="absolute right-0 top-12 z-[70] w-72 rounded-[var(--hx-radius-lg)] border border-[var(--hx-border)] bg-[var(--hx-surface)] p-2 shadow-[var(--hx-shadow-lg)]">
              <div className="px-3 py-2.5">
                <div className="truncate text-[14px] font-semibold text-[var(--hx-text)]">{name}</div>
                <div className="truncate text-[12px] text-[var(--hx-text-3)]">{email}</div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium">
                  {workspaceName ? <span className="rounded-full bg-[var(--hx-surface-2)] px-2 py-0.5 text-[var(--hx-text-2)]">{workspaceName}</span> : null}
                  {role ? <span className="rounded-full bg-[var(--hx-accent-soft)] px-2 py-0.5 text-[var(--hx-accent-strong)]">{normalizeRoleLabel(role)}</span> : null}
                </div>
              </div>
              <div className="my-1 h-px bg-[var(--hx-border)]" />
              <Link role="menuitem" href="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-[13px] text-[var(--hx-text-2)] hover:bg-[var(--hx-surface-2)] hover:text-[var(--hx-text)]">
                <Settings size={16} aria-hidden="true" /> Configurações
              </Link>
              <button role="menuitem" type="button" onClick={handleLogout} disabled={loggingOut} className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2 text-left text-[13px] text-[var(--hx-text-2)] hover:bg-red-50 hover:text-red-700 disabled:opacity-60">
                <LogOut size={16} aria-hidden="true" /> {loggingOut ? 'Encerrando…' : 'Sair da conta'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
