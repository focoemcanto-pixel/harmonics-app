'use client';

import { Search } from 'lucide-react';

// Topo do celular: workspace + título da tela e ações da página. A navegação fica na barra inferior.
export default function AdminMobileTopbar({ title, actions, subtitle, workspaceName, workspaceLoading = false, primaryColor, onOpenSearch }) {
  const brandingName = workspaceLoading ? 'Carregando…' : workspaceName || 'Workspace';

  return (
    <header className="sticky top-0 z-[80] border-b border-[var(--hx-border)] bg-[color-mix(in_srgb,var(--hx-canvas)_90%,transparent)] px-4 pb-2.5 pt-[calc(env(safe-area-inset-top,0px)+10px)] backdrop-blur-xl md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: primaryColor || 'var(--hx-text-3)' }}>
            {brandingName}
          </div>
          <div className="mt-0.5 truncate text-[19px] font-semibold tracking-[-0.02em] text-[var(--hx-text)]">{title}</div>
          {subtitle ? <div className="mt-0.5 truncate text-[12px] text-[var(--hx-text-2)]">{subtitle}</div> : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {actions ? <div className="shrink-0 touch-manipulation">{actions}</div> : null}
          <button
            type="button"
            aria-label="Buscar tela"
            onClick={onOpenSearch}
            className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-[var(--hx-border)] bg-[var(--hx-surface)] text-[var(--hx-text)] shadow-[var(--hx-shadow-sm)] active:scale-[0.97]"
          >
            <Search size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
