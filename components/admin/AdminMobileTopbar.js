'use client';

import useCurrentWorkspace from '@/hooks/useCurrentWorkspace';
import { Menu } from 'lucide-react';

export default function AdminMobileTopbar({ title, actions, subtitle, onOpenMenu }) {
  const { workspace, loading: workspaceLoading } = useCurrentWorkspace();

  const brandingName = workspaceLoading ? 'Carregando workspace...' : workspace?.displayName || 'Workspace';
  const primaryColor = workspace?.primaryColor || '#7c3aed';

  return (
    <header className="sticky top-0 z-[80] border-b border-[#e5e7eb] bg-[rgba(244,246,250,0.96)] px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] backdrop-blur-xl supports-[backdrop-filter]:bg-[rgba(244,246,250,0.88)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[11px] font-extrabold uppercase tracking-[0.08em]"
            style={{ color: primaryColor }}
          >
            {brandingName}
          </div>

          <div className="mt-1 truncate text-[20px] font-black text-[#111827]">
            {title}
          </div>

          {subtitle ? (
            <div className="mt-1 truncate text-[12px] font-semibold text-[#64748b]">
              {subtitle}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            data-onboarding-tour="mobile-more"
            aria-label="Abrir menu"
            onClick={() => onOpenMenu?.()}
            className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#0f172a] shadow-[0_8px_20px_rgba(15,23,42,0.06)] active:scale-[0.98]"
          >
            <Menu size={19} />
          </button>
          {actions ? <div className="ml-1 shrink-0">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}
