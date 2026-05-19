'use client';

import useCurrentWorkspace from '@/hooks/useCurrentWorkspace';
import { Menu } from 'lucide-react';

export default function AdminMobileTopbar({ title, actions, subtitle, onOpenMenu }) {
  const { workspace, loading: workspaceLoading } = useCurrentWorkspace();

  const brandingName = workspaceLoading ? 'Carregando workspace...' : workspace?.displayName || 'Workspace';
  const primaryColor = workspace?.primaryColor || '#7c3aed';

  return (
    <header className="sticky top-0 z-40 border-b border-[#e5e7eb] bg-[rgba(244,246,250,0.94)] px-4 py-3 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-[11px] font-extrabold uppercase tracking-[0.08em]"
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
          <button type="button" data-onboarding-tour="mobile-more" aria-label="Abrir menu" onClick={() => onOpenMenu?.()} className="rounded-xl border border-[#e2e8f0] bg-white p-2 text-[#0f172a]">
            <Menu size={18} />
          </button>
          {actions ? <div className="ml-1">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}
