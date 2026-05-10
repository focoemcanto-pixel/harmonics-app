'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import useWorkspaceMe from '@/hooks/useWorkspaceMe';

function navClass(active) {
  return active
    ? 'bg-violet-100 text-violet-700 shadow-[0_10px_24px_rgba(124,58,237,0.08)]'
    : 'text-[#c7d2fe] hover:bg-white/5 hover:text-white';
}

const ALL_ITEMS = [
  { key: 'dashboard', module: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { key: 'eventos', module: 'eventos', label: 'Eventos', href: '/eventos' },
  { key: 'contatos', module: 'contatos', label: 'Contatos', href: '/contatos' },
  { key: 'convites', module: 'convites', label: 'Convites', href: '/convites' },
  { key: 'escalas', module: 'escalas', label: 'Escalas', href: '/escalas' },
  { key: 'contratos', module: 'contratos', label: 'Contratos', href: '/contratos' },
  { key: 'repertorios', module: 'repertorios', label: 'Repertórios', href: '/repertorios' },
  { key: 'sugestoes', module: 'sugestoes', label: 'Sugestões', href: '/sugestoes' },
  { key: 'automacoes', module: 'automacoes', label: 'Automação', href: '/automacoes' },
  { key: 'avaliacoes', module: 'avaliacoes', label: 'Avaliações', href: '/avaliacoes' },
  { key: 'pagamentos', module: 'pagamentos', label: 'Pagamentos', href: '/pagamentos' },
  { key: 'usuarios', module: 'usuarios', label: 'Usuários', href: '/configuracoes/equipe' },
];

function normalizeRoleLabel(role) {
  const value = String(role || '').toLowerCase();
  const labels = {
    owner: '👑 Owner',
    admin: '🔑 Admin',
    financeiro: '💰 Financeiro',
    operacional: '🎼 Operacional',
    editor: '✍️ Editor',
    viewer: '👁️ Visualizador',
  };
  return labels[value] || value || 'Membro';
}

function SidebarSkeleton() {
  return (
    <div className="mt-8 space-y-2 px-1">
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div key={item} className="h-11 animate-pulse rounded-2xl bg-white/5" />
      ))}
    </div>
  );
}

export default function AdminSidebar({ activeItem = 'eventos' }) {
  const pathname = usePathname();
  const { signOut, profile } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { workspaceMe, loading: permissionsLoading, modules, role } = useWorkspaceMe();
  const automationOpen = pathname?.startsWith('/automacoes');
  const contractsOpen = pathname?.startsWith('/contratos');
  const eventsOpen = pathname?.startsWith('/eventos');

  const allowedModules = useMemo(() => {
    if (Array.isArray(modules) && modules.length > 0) {
      return new Set(modules);
    }
    return new Set(['dashboard']);
  }, [modules]);

  const items = useMemo(
    () => ALL_ITEMS.filter((item) => allowedModules.has(item.module)),
    [allowedModules]
  );

  const automationItems = [
    { label: 'Regras', href: '/automacoes/regras' },
    { label: 'Templates', href: '/automacoes/templates' },
    { label: 'Canais', href: '/automacoes/canais' },
    { label: 'Logs', href: '/automacoes/logs' },
  ];

  const contractItems = [
    { label: 'Visão geral', href: '/contratos' },
    { label: 'Templates', href: '/contratos/templates' },
  ];

  const eventItems = [
    { label: 'Visão geral', href: '/eventos' },
    { label: 'Tipos de evento', href: '/eventos/tipos' },
  ];

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      await signOut({ redirect: true });
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <aside className="sticky top-0 flex min-h-screen w-[280px] shrink-0 flex-col bg-[#020b2c] px-5 py-6 text-white">
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/90 shadow-[0_4px_20px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.08)]">
          <span className="text-lg font-semibold tracking-tight text-white">H</span>
        </div>
        <div>
          <div className="text-[15px] font-black">Harmonics</div>
          <div className="text-[12px] text-[#a5b4fc]">Admin</div>
        </div>
      </div>

      {permissionsLoading ? (
        <SidebarSkeleton />
      ) : (
        <nav className="mt-8 space-y-2">
          {items.map((item) => (
            <div key={item.key}>
              <Link href={item.href} className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-[15px] font-bold transition ${navClass(activeItem === item.key)}`}>
                {item.label}
              </Link>

              {item.key === 'eventos' && eventsOpen && (
                <div className="ml-6 mt-1 space-y-1 border-l border-violet-400/30 pl-3">
                  {eventItems.map((sub) => (
                    <Link key={sub.href} href={sub.href} className={`block rounded-lg px-3 py-1.5 text-[13px] font-semibold ${pathname === sub.href ? 'bg-violet-200/20 text-violet-200' : 'text-[#a5b4fc] hover:text-white'}`}>
                      {sub.label}
                    </Link>
                  ))}
                </div>
              )}

              {item.key === 'contratos' && contractsOpen && (
                <div className="ml-6 mt-1 space-y-1 border-l border-violet-400/30 pl-3">
                  {contractItems.map((sub) => (
                    <Link key={sub.href} href={sub.href} className={`block rounded-lg px-3 py-1.5 text-[13px] font-semibold ${pathname === sub.href ? 'bg-violet-200/20 text-violet-200' : 'text-[#a5b4fc] hover:text-white'}`}>
                      {sub.label}
                    </Link>
                  ))}
                </div>
              )}

              {item.key === 'automacoes' && automationOpen && (
                <div className="ml-6 mt-1 space-y-1 border-l border-violet-400/30 pl-3">
                  {automationItems.map((sub) => (
                    <Link key={sub.href} href={sub.href} className={`block rounded-lg px-3 py-1.5 text-[13px] font-semibold ${pathname === sub.href ? 'bg-violet-200/20 text-violet-200' : 'text-[#a5b4fc] hover:text-white'}`}>
                      {sub.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      )}

      <div className="mt-auto px-2 pt-6">
        {profile && (
          <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#a5b4fc]">Usuário atual</div>
            <div className="mt-1 truncate text-[13px] font-bold text-white">{profile.name || profile.email}</div>
            <div className="mt-1 text-[11px] font-semibold text-violet-300">
              {normalizeRoleLabel(role || workspaceMe?.role || profile.role)}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          aria-busy={isLoggingOut}
          className={`group mb-3 w-full rounded-2xl border px-4 py-3 text-[14px] font-bold transition duration-200 ${
            isLoggingOut
              ? 'cursor-wait border-red-400/30 bg-[linear-gradient(135deg,rgba(127,29,29,0.56),rgba(69,10,10,0.42))] text-red-100 opacity-75'
              : 'border-red-400/30 bg-[linear-gradient(135deg,rgba(127,29,29,0.28),rgba(69,10,10,0.18))] text-red-100 shadow-[0_8px_24px_rgba(239,68,68,0.16)] hover:scale-[1.01] hover:border-red-300/60 hover:shadow-[0_12px_32px_rgba(239,68,68,0.24)] active:scale-[0.995]'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            {isLoggingOut && <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200/70 border-t-red-300" />}
            {!isLoggingOut && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            )}
            {isLoggingOut ? 'Encerrando sessão...' : 'Sair da conta'}
          </span>
        </button>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#a5b4fc]">Harmonics SaaS</div>
          <div className="mt-2 text-[14px] font-bold text-white">Painel administrativo híbrido</div>
        </div>
      </div>
    </aside>
  );
}
