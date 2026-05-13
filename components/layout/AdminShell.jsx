'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AdminSidebar from '../admin/AdminSidebar';
import AdminMobileTopbar from '../admin/AdminMobileTopbar';
import AdminBottomNav from '../admin/AdminBottomNav';
import DashboardOnboardingBanner from '@/components/onboarding/DashboardOnboardingBanner';
import OnboardingTourOverlay from '@/components/onboarding/OnboardingTourOverlay';
import OperationalRouteOnboarding from '@/components/onboarding/OperationalRouteOnboarding';
import WorkspaceActivityTimeline from '@/components/workspace/WorkspaceActivityTimeline';
import { useAuth } from '@/contexts/AuthContext';
import { redirectToLogin } from '@/lib/auth/logoutRedirect';
import useWorkspaceMe from '@/hooks/useWorkspaceMe';
import { getSupabase } from '@/lib/supabase';

const MORE_ITEMS = [
  { module: 'workspace', label: 'Configurações', href: '/settings', icon: '⚙️', helper: 'Perfil, workspace, assinatura e segurança' },
  { module: 'workspace', label: 'Workspace', href: '/settings/workspace', icon: '🏢', helper: 'Branding, tema e zona de perigo' },
  { module: 'escalas', label: 'Escalas', href: '/escalas', icon: '🎼', helper: 'Operação musical' },
  { module: 'convites', label: 'Convites', href: '/convites', icon: '✉️', helper: 'Chamadas e respostas' },
  { module: 'contratos', label: 'Contratos', href: '/contratos', icon: '📝', helper: 'Fluxo contratual' },
  { module: 'eventos', label: 'Tipos de evento', href: '/eventos/tipos', icon: '🏷️', helper: 'Catálogo de eventos' },
  { module: 'contratos', label: 'Templates contratos', href: '/contratos/templates', icon: '📄', helper: 'Modelos base' },
  { module: 'contratos', label: 'Pré-contratos', href: '/pre-contratos', icon: '🔗', helper: 'Comercial inicial' },
  { module: 'repertorios', label: 'Repertórios', href: '/repertorios', icon: '🎧', helper: 'Organização musical' },
  { module: 'sugestoes', label: 'Sugestões', href: '/sugestoes', icon: '✨', helper: 'Ideias e votações' },
  { module: 'pagamentos', label: 'Pagamentos', href: '/pagamentos', icon: '💳', helper: 'Controle financeiro' },
  { module: 'automacoes', label: 'Automação', href: '/automacoes', icon: '⚙️', helper: 'Central de automação' },
  { module: 'usuarios', label: 'Usuários', href: '/configuracoes/equipe', icon: '👥', helper: 'Gestão de usuários' },
];

const MOBILE_NAV_ALLOWED_ITEMS = new Set(['dashboard', 'eventos', 'contatos', 'contratos', 'mais']);
const ONBOARDING_ROUTE_PREFIXES = ['/dashboard', '/eventos', '/pre-contratos', '/contratos/templates'];

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

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

const MobileMoreSheet = memo(function MobileMoreSheet({ open, onClose, onNavigate, visibleItems, workspaceRole }) {
  const { signOut, profile } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function handleEscape(event) {
      if (event.key === 'Escape' && !isLoggingOut) onClose?.();
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isLoggingOut, open, onClose]);

  if (!open) return null;

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await signOut({ redirect: true });
      onClose?.();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-[3px] md:hidden" onClick={(e) => e.target === e.currentTarget && !isLoggingOut && onClose?.()}>
      <div className="flex h-[100dvh] items-end justify-center">
        <div className="w-full max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-[30px] border border-white/10 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-4 shadow-[0_-20px_60px_rgba(15,23,42,0.18)]" onClick={(e) => e.stopPropagation()}>
          <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-slate-200" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.12em] text-violet-700/80">Mais opções</div>
              <div className="mt-1 text-[24px] font-black tracking-[-0.04em] text-[#111827]">Atalhos do admin</div>
              <div className="mt-1 text-[13px] font-semibold text-[#64748b]">Módulos disponíveis para seu nível de acesso.</div>
            </div>

            <button type="button" onClick={() => !isLoggingOut && onClose?.()} disabled={isLoggingOut} className="rounded-[16px] border border-[#e5e7eb] bg-white px-4 py-2 text-[13px] font-black text-[#111827]">Fechar</button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {visibleItems.map((item) => (
              <button key={item.href} type="button" onClick={() => onNavigate?.(item.href)} className="rounded-[22px] border border-[#e5e7eb] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-4 py-4 text-left shadow-[0_10px_24px_rgba(17,24,39,0.04)]">
                <div className="text-[20px]">{item.icon}</div>
                <div className="mt-3 text-[14px] font-black tracking-[-0.02em] text-[#111827]">{item.label}</div>
                <div className="mt-1 text-[11px] font-semibold leading-5 text-[#64748b]">{item.helper}</div>
              </button>
            ))}
          </div>

          {profile && (
            <div className="mt-4 rounded-[22px] border border-[#e5e7eb] bg-[#f8fafc] px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[13px] font-black text-violet-700">
                  {getInitials(profile.name || profile.email)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-black text-[#111827]">{profile.name || profile.email}</p>
                  <p className="text-[12px] text-violet-600">{normalizeRoleLabel(workspaceRole || profile.role)}</p>
                </div>
              </div>
            </div>
          )}

          <button type="button" onClick={handleLogout} disabled={isLoggingOut} className="mt-3 flex w-full items-center justify-between rounded-[22px] border border-red-400/30 bg-gradient-to-r from-red-500 to-red-600 px-5 py-4 text-[15px] font-black text-white shadow-[0_16px_34px_rgba(239,68,68,0.28)]">
            <span>{isLoggingOut ? 'Encerrando sessão...' : 'Sair da conta'}</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default function AdminShell({ pageTitle, children, mobileActions, activeItem = 'eventos', mobileSubtitle = '' }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabase(), []);
  const { user, initialized, loading } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const { workspaceMe, modules, role } = useWorkspaceMe({ enabled: Boolean(initialized && !loading && user) });

  const allowedModules = useMemo(() => {
    if (Array.isArray(modules) && modules.length > 0) {
      return new Set([...modules, 'workspace']);
    }
    return new Set(['dashboard', 'workspace']);
  }, [modules]);

  const visibleMoreItems = useMemo(() => MORE_ITEMS.filter((item) => allowedModules.has(item.module)), [allowedModules]);
  const mobileActiveItem = MOBILE_NAV_ALLOWED_ITEMS.has(activeItem) ? activeItem : 'mais';
  const isOnboardingRoute = ONBOARDING_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`));

  useEffect(() => {
    if (initialized && !loading && !user && pathname !== '/login') {
      redirectToLogin();
    }
  }, [initialized, loading, pathname, user]);

  useEffect(() => {
    let active = true;

    async function loadTourEligibility() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        if (!token) return;

        const response = await fetch('/api/onboarding/progress', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });

        const payload = await response.json().catch(() => null);
        if (!active) return;

        setShowTour(Boolean(response.ok && payload?.showOnboarding));
      } catch {
        if (active) setShowTour(false);
      }
    }

    if (isOnboardingRoute) {
      loadTourEligibility();
    } else {
      setShowTour(false);
    }

    return () => {
      active = false;
    };
  }, [isOnboardingRoute, pathname, supabase]);

  if (initialized && !loading && !user) {
    return null;
  }

  const showDashboardOnboarding = pathname === '/dashboard';
  const showOperationalRouteOnboarding = showTour && pathname !== '/dashboard';

  return (
    <div className="min-h-screen bg-[#f4f6fa] text-[#111827]">
      {showTour ? <OnboardingTourOverlay /> : null}

      <div className="hidden md:flex">
        <AdminSidebar activeItem={activeItem} />

        <main className="min-h-screen flex-1">
          <div className="mx-auto w-full max-w-[1440px] px-6 py-6">
            {showDashboardOnboarding ? <div className="mb-5"><DashboardOnboardingBanner /></div> : null}
            {showDashboardOnboarding ? <div className="mb-5"><WorkspaceActivityTimeline limit={6} compact /></div> : null}
            {showOperationalRouteOnboarding ? <OperationalRouteOnboarding enabled /> : null}
            {children}
          </div>
        </main>
      </div>

      <div className="md:hidden">
        <AdminMobileTopbar title={pageTitle} subtitle={mobileSubtitle} actions={mobileActions} />

        <main className="px-4 pb-28 pt-4">
          {showDashboardOnboarding ? <div className="mb-4"><DashboardOnboardingBanner /></div> : null}
          {showDashboardOnboarding ? <div className="mb-4"><WorkspaceActivityTimeline limit={4} compact /></div> : null}
          {showOperationalRouteOnboarding ? <OperationalRouteOnboarding enabled /> : null}
          {children}
        </main>

        <AdminBottomNav activeItem={mobileActiveItem} onOpenMore={() => setMoreOpen(true)} allowedModules={allowedModules} />

        <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} onNavigate={(href) => { setMoreOpen(false); router.push(href); }} visibleItems={visibleMoreItems} workspaceRole={role || workspaceMe?.role} />
      </div>
    </div>
  );
}

export { MobileMoreSheet };
