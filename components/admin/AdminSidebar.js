'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import useCurrentWorkspace from '@/hooks/useCurrentWorkspace';

const ITEMS = [
  ['Dashboard', '/dashboard'],
  ['Eventos', '/eventos'],
  ['Contatos', '/contatos'],
  ['Convites', '/convites'],
  ['Escalas', '/escalas'],
  ['Contratos', '/contratos'],
  ['Repertórios', '/repertorios'],
  ['Sugestões', '/sugestoes'],
  ['Automação', '/automacoes'],
  ['Avaliações', '/avaliacoes'],
  ['Pagamentos', '/pagamentos'],
  ['Configurações', '/settings'],
];

const EVENTOS_ITEMS = [
  ['Visão geral', '/eventos'],
  ['Tipos de evento', '/eventos/tipos'],
];

const CONTRATOS_ITEMS = [
  ['Visão geral', '/contratos'],
  ['Templates de contrato', '/contratos/templates'],
];

const SETTINGS_ITEMS = [
  ['Visão geral', '/settings'],
  ['Onboarding', '/settings/onboarding'],
  ['Workspace', '/settings/workspace'],
  ['Equipe', '/configuracoes/equipe'],
];

export default function AdminSidebar({ activeItem = 'dashboard' }) {
  const pathname = usePathname();
  const { signOut, profile } = useAuth();
  const { workspace, loading: workspaceLoading } = useCurrentWorkspace();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);

    try {
      await signOut({ redirect: true });
    } finally {
      setLoading(false);
    }
  }

  const eventosOpen = pathname === '/eventos' || pathname?.startsWith('/eventos/');
  const contratosOpen = pathname === '/contratos' || pathname?.startsWith('/contratos/');
  const settingsOpen = pathname?.startsWith('/settings') || pathname?.startsWith('/configuracoes');

  function renderSubItems(items) {
    return (
      <div className="ml-6 mt-1 space-y-1 border-l border-violet-400/30 pl-3">
        {items.map(([subLabel, subHref]) => (
          <Link
            key={subHref}
            href={subHref}
            className={`block rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
              pathname === subHref
                ? 'bg-violet-200/20 text-violet-200'
                : 'text-[#a5b4fc] hover:text-white'
            }`}
          >
            {subLabel}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <aside className="sticky top-0 flex min-h-screen w-[280px] shrink-0 flex-col bg-[#020b2c] px-5 py-6 text-white">
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/70 text-lg font-black text-white">
          {workspaceLoading ? '…' : workspace?.initials || 'H'}
        </div>

        <div>
          <div className="text-[15px] font-black text-white">
            {workspaceLoading ? 'Carregando workspace...' : workspace?.displayName || 'Harmonics'}
          </div>
          <div className="text-[12px] text-[#a5b4fc]">
            Workspace Admin
          </div>
        </div>
      </div>

      <nav className="mt-8 space-y-2">
        {ITEMS.map(([label, href]) => {
          const active =
            pathname === href ||
            (href === '/eventos' && eventosOpen) ||
            (href === '/contratos' && contratosOpen) ||
            (href === '/settings' && settingsOpen);

          return (
            <div key={href}>
              <Link
                href={href}
                className={`flex rounded-2xl px-4 py-3 text-[15px] font-bold transition ${
                  active
                    ? 'bg-violet-100 text-violet-700'
                    : 'text-[#c7d2fe] hover:bg-white/5 hover:text-white'
                }`}
              >
                {label}
              </Link>

              {href === '/eventos' && eventosOpen && renderSubItems(EVENTOS_ITEMS)}
              {href === '/contratos' && contratosOpen && renderSubItems(CONTRATOS_ITEMS)}
              {href === '/settings' && settingsOpen && renderSubItems(SETTINGS_ITEMS)}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto px-2 pt-6">
        <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#a5b4fc]">
            Usuário atual
          </div>
          <div className="mt-1 truncate text-[13px] font-bold text-white">
            {profile?.name || profile?.email || 'Usuário'}
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mb-3 w-full rounded-2xl border border-red-400/30 bg-red-950/30 px-4 py-3 text-[14px] font-bold text-red-100"
        >
          {loading ? 'Encerrando...' : 'Sair da conta'}
        </button>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#a5b4fc]">
            Workspace atual
          </div>
          <div className="mt-2 truncate text-[14px] font-bold text-white">
            {workspace?.displayName || 'Workspace'}
          </div>
        </div>
      </div>
    </aside>
  );
}
