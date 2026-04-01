'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminSidebar from '../admin/AdminSidebar';
import AdminMobileTopbar from '../admin/AdminMobileTopbar';
import AdminBottomNav from '../admin/AdminBottomNav';

const MORE_ITEMS = [
  { label: 'Financeiro', href: '/pagamentos', icon: '💸', helper: 'Pagamentos e caixa' },
  { label: 'Escalas', href: '/escalas', icon: '🎼', helper: 'Operação musical' },
  { label: 'Convites', href: '/convites', icon: '📨', helper: 'Chamadas e respostas' },
  { label: 'Contratos', href: '/contratos', icon: '📝', helper: 'Fluxo contratual' },
  { label: 'Pré-contratos', href: '/pre-contratos', icon: '🔗', helper: 'Comercial inicial' },
  { label: 'Repertórios', href: '/repertorios', icon: '🎧', helper: 'Organização musical' },
];

function MobileMoreSheet({ open, onClose, onNavigate }) {
  if (!open) return null;

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose?.();
  }

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-[3px] md:hidden"
      onClick={handleBackdropClick}
    >
      <div className="flex h-[100dvh] items-end justify-center">
        <div
          className="w-full rounded-t-[30px] border border-white/10 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-4 shadow-[0_-20px_60px_rgba(15,23,42,0.18)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-slate-200" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.12em] text-violet-700/80">
                Mais opções
              </div>
              <div className="mt-1 text-[24px] font-black tracking-[-0.04em] text-[#111827]">
                Atalhos do admin
              </div>
              <div className="mt-1 text-[13px] font-semibold text-[#64748b]">
                Acesse os módulos sem lotar a navegação principal.
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-[16px] border border-[#e5e7eb] bg-white px-4 py-2 text-[13px] font-black text-[#111827]"
            >
              Fechar
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {MORE_ITEMS.map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => onNavigate?.(item.href)}
                className="rounded-[22px] border border-[#e5e7eb] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-4 py-4 text-left shadow-[0_10px_24px_rgba(17,24,39,0.04)]"
              >
                <div className="text-[20px]">{item.icon}</div>
                <div className="mt-3 text-[14px] font-black tracking-[-0.02em] text-[#111827]">
                  {item.label}
                </div>
                <div className="mt-1 text-[11px] font-semibold leading-5 text-[#64748b]">
                  {item.helper}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminShell({
  pageTitle,
  children,
  mobileActions,
  activeItem = 'eventos',
  mobileSubtitle = '',
}) {
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const mobileActiveItem = useMemo(() => {
    const allowed = ['dashboard', 'eventos', 'contatos', 'contratos', 'mais'];
    if (allowed.includes(activeItem)) return activeItem;
    return 'mais';
  }, [activeItem]);

  function handleNavigate(href) {
    setMoreOpen(false);
    router.push(href);
  }

  return (
    <div className="min-h-screen bg-[#f4f6fa] text-[#111827]">
      <div className="hidden md:flex">
        <AdminSidebar activeItem={activeItem} />
        <main className="min-h-screen flex-1">
          <div className="mx-auto w-full max-w-[1440px] px-6 py-6">
            {children}
          </div>
        </main>
      </div>

      <div className="md:hidden">
        <AdminMobileTopbar
          title={pageTitle}
          subtitle={mobileSubtitle}
          actions={mobileActions}
        />

        <main className="px-4 pb-28 pt-4">{children}</main>

        <AdminBottomNav
          activeItem={mobileActiveItem}
          onNavigate={handleNavigate}
          onOpenMore={() => setMoreOpen(true)}
        />

        <MobileMoreSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          onNavigate={handleNavigate}
        />
      </div>
    </div>
  );
}
