'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import useWorkspaceMe from '@/hooks/useWorkspaceMe';
import useCurrentWorkspace from '@/hooks/useCurrentWorkspace';

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
  { key: 'settings', module: 'workspace', label: 'Configurações', href: '/settings' },
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
  const { workspace: currentWorkspace } = useCurrentWorkspace();
  const automationOpen = pathname?.startsWith('/automacoes');
  const contractsOpen = pathname?.startsWith('/contratos');
  const eventsOpen = pathname?.startsWith('/eventos');
  const settingsOpen = pathname?.startsWith('/settings') || pathname?.startsWith('/configuracoes') || pathname?.startsWith('/getting-started');

  const allowedModules = useMemo(() => {
    if (Array.isArray(modules) && modules.length > 0) {
      return new Set([...modules, 'workspace']);
    }
    return new Set(['dashboard', 'workspace']);
  }, [modules]);

  const items = useMemo(
    () => ALL_ITEMS.filter((item) => allowedModules.has(item.module)),
    [allowedModules]
  );

  const brandingName = currentWorkspace?.displayName || 'Workspace';
  const brandingInitials = currentWorkspace?.initials || 'W';
  const brandingColor = currentWorkspace?.primaryColor || '#7c3aed';

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

  const settingsItems = [
    { label: 'Visão geral', href: '/settings' },
    { label: 'Primeiros passos', href: '/getting-started' },
    { label: 'Workspace', href: '/settings/workspace' },
    { label: 'Equipe', href: '/configuracoes/equipe' },
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

  return 'TRUNCATED_FOR_UPDATE';
}
