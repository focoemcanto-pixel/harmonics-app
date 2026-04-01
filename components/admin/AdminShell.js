'use client';

import { useState } from 'react';
import Link from 'next/link';
import AdminSidebar from './AdminSidebar';
import AdminMobileTopbar from './AdminMobileTopbar';
import AdminBottomNav from './AdminBottomNav';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

function MoreDrawer({ open, onClose }) {
  const items = [
    { key: 'convites', icon: '✉️', label: 'Convites', href: '/convites' },
    { key: 'escalas', icon: '🎼', label: 'Escalas', href: '/escalas' },
    { key: 'repertorios', icon: '🎵', label: 'Repertórios', href: '/repertorios' },
    { key: 'sugestoes', icon: '✨', label: 'Sugestões', href: '/sugestoes' },
    { key: 'pagamentos', icon: '💳', label: 'Pagamentos', href: '/pagamentos' },
  ];

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Fechar menu"
        onClick={onClose}
        className="fixed inset-0 z-[85] bg-[rgba(15,23,42,0.38)] backdrop-blur-[2px]"
      />

      <div className="fixed inset-x-0 bottom-0 z-[90] rounded-t-[30px] border border-[#e5e7eb] bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-4 shadow-[0_-20px_50px_rgba(15,23,42,0.18)]">
        <div className="mx-auto w-full max-w-[520px]">
          <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-[#d1d5db]" />

          <div className="mb-4">
            <div className="text-[12px] font-black uppercase tracking-[0.1em] text-violet-600">
              Mais opções
            </div>
            <div className="mt-1 text-[22px] font-black tracking-[-0.03em] text-[#111827]">
              Central administrativa
            </div>
            <div className="mt-1 text-[14px] leading-6 text-[#6b7280]">
              Acesse os módulos complementares do Harmonics Admin.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={onClose}
                className="flex min-h-[88px] flex-col justify-center rounded-[22px] border border-[#e5e7eb] bg-[#f8fafc] px-4 py-4 transition active:scale-[0.99]"
              >
                <span className="text-[22px]">{item.icon}</span>
                <span className="mt-2 text-[14px] font-black text-[#111827]">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-4 flex w-full items-center justify-center rounded-[18px] border border-[#e5e7eb] bg-white px-4 py-4 text-[15px] font-black text-[#111827]"
          >
            Fechar
          </button>
        </div>
      </div>
    </>
  );
}

export default function AdminShell({
  pageTitle,
  children,
  mobileActions,
  activeItem = 'eventos',
}) {
  const [moreOpen, setMoreOpen] = useState(false);

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
        <AdminMobileTopbar title={pageTitle} actions={mobileActions} />
        <main className="px-4 pb-28 pt-4">{children}</main>

        <AdminBottomNav
          activeItem={activeItem}
          onOpenMore={() => setMoreOpen(true)}
        />

        <MoreDrawer
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
        />
      </div>
    </div>
  );
}
