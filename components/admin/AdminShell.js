'use client';

import { useState } from 'react';
import Link from 'next/link';
import AdminSidebar from './AdminSidebar';
import AdminMobileTopbar from './AdminMobileTopbar';
import AdminBottomNav from './AdminBottomNav';
import { useAuth } from '@/contexts/AuthContext';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

function MoreDrawer({ open, onClose }) {
  const { signOut, profile } = useAuth();
  const items = [
    { key: 'financeiro', icon: '💸', label: 'Financeiro', href: '/financeiro' },
    { key: 'escalas', icon: '🎼', label: 'Escalas', href: '/escalas' },
    { key: 'convites', icon: '✉️', label: 'Convites', href: '/convites' },
    { key: 'contratos', icon: '📝', label: 'Contratos', href: '/contratos' },
    { key: 'precontratos', icon: '🔗', label: 'Pré-contratos', href: '/pre-contratos' },
    { key: 'repertorios', icon: '🎧', label: 'Repertórios', href: '/repertorios' },
    { key: 'sugestoes', icon: '✨', label: 'Sugestões', href: '/sugestoes' },
    { key: 'pagamentos', icon: '💳', label: 'Pagamentos', href: '/pagamentos' },
    { key: 'automacoes', icon: '⚙️', label: 'Automação', href: '/automacoes' },
    { key: 'usuarios', icon: '👥', label: 'Usuários', href: '/admin/usuarios' },
  ];

  function getInitials(name) {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  async function handleLogout() {
    onClose();
    await signOut();
  }

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

          {profile && (
            <div className="mt-4 rounded-[22px] border border-[#e5e7eb] bg-[#f8fafc] px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[13px] font-black text-violet-700">
                  {getInitials(profile.name || profile.email)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-black text-[#111827]">
                    {profile.name || profile.email}
                  </p>
                  <p className="text-[12px] text-violet-600">
                    {profile.role === 'admin' ? '🔑 Administrador' : '👤 Membro'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-between rounded-[22px] bg-gradient-to-r from-red-500 to-red-600 px-5 py-4 text-[15px] font-black text-white shadow-lg transition active:scale-[0.99]"
          >
            <span>Sair da conta</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="mt-3 flex w-full items-center justify-center rounded-[18px] border border-[#e5e7eb] bg-white px-4 py-4 text-[15px] font-black text-[#111827]"
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
