'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import AdminSidebar from '../admin/AdminSidebar';
import AdminMobileTopbar from '../admin/AdminMobileTopbar';
import AdminBottomNav from '../admin/AdminBottomNav';
import DeferredOnboardingMount from '@/components/onboarding/DeferredOnboardingMount';
import { useAuth } from '@/contexts/AuthContext';
import { redirectToLogin } from '@/lib/auth/logoutRedirect';
import useWorkspaceMe from '@/hooks/useWorkspaceMe';
import { getSupabase } from '@/lib/supabase';

const MOBILE_DRAWER_SECTIONS = [
  { key: 'operacional', label: 'OPERACIONAL', items: [{ module: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: '🏠', helper: 'Visão executiva' }, { module: 'eventos', label: 'Eventos', href: '/eventos', icon: '📅', helper: 'Próximas entregas' }, { module: 'escalas', label: 'Escalas', href: '/escalas', icon: '🎼', helper: 'Operação musical' }, { module: 'convites', label: 'Convites', href: '/convites', icon: '✉️', helper: 'Chamadas e respostas' }] },
  { key: 'comercial', label: 'COMERCIAL', items: [{ module: 'contratos', label: 'Contratos', href: '/contratos', icon: '📝', helper: 'Fluxo contratual' }, { module: 'contratos', label: 'Pré-contratos', href: '/pre-contratos', icon: '🔗', helper: 'Comercial inicial' }, { module: 'pagamentos', label: 'Pagamentos', href: '/pagamentos', icon: '💳', helper: 'Receitas e custos' }] },
  { key: 'musical', label: 'MUSICAL', items: [{ module: 'repertorios', label: 'Repertórios', href: '/repertorios', icon: '🎧', helper: 'Biblioteca principal' }, { module: 'sugestoes', label: 'Sugestões', href: '/sugestoes', icon: '✨', helper: 'Ideias do cliente' }] },
  { key: 'equipe', label: 'EQUIPE', items: [{ module: 'contatos', label: 'Contatos', href: '/contatos', icon: '📇', helper: 'Rede e fornecedores' }] },
  { key: 'automacao', label: 'AUTOMAÇÃO', items: [{ module: 'automacoes', label: 'Automação', href: '/automacoes', icon: '⚡', helper: 'Fluxos e rotinas' }, { module: 'automacoes', label: 'Templates', href: '/automacoes/templates', icon: '📄', helper: 'Mensagens e ações' }, { module: 'automacoes', label: 'Logs', href: '/automacoes/logs', icon: '🧠', helper: 'Histórico de execução' }] },
  { key: 'sistema', label: 'SISTEMA', items: [{ module: 'workspace', label: 'Configurações', href: '/settings', icon: '⚙️', helper: 'Conta e segurança' }, { module: 'workspace', label: 'Workspace', href: '/settings/workspace', icon: '🏢', helper: 'Marca e identidade' }] },
];

const MOBILE_NAV_ALLOWED_ITEMS = new Set(['dashboard', 'eventos', 'mais']);
const ONBOARDING_ROUTE_PREFIXES = ['/dashboard', '/eventos', '/pre-contratos', '/contratos/templates', '/automacoes', '/configuracoes/equipe', '/templates-escala', '/escalas/templates', '/pagamentos', '/repertorios'];

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

const MobileMoreSheet = memo(function MobileMoreSheet({ open, onClose, onNavigate, visibleSections, workspaceRole }) {
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
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-md md:hidden" onClick={(e) => e.target === e.currentTarget && !isLoggingOut && onClose?.()}>
      <div className="flex h-[100dvh] items-stretch justify-start">
        <div className="h-full w-[84vw] max-w-[360px] overflow-hidden overscroll-contain border-r border-white/10 bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] shadow-[30px_0_80px_rgba(15,23,42,0.55)]" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-200">Navegação</div>
              <div className="mt-1 text-[20px] font-black tracking-[-0.03em] text-white">Workspace operacional</div>
            </div>

            <button type="button" onClick={() => !isLoggingOut && onClose?.()} disabled={isLoggingOut} className="rounded-full border border-white/20 bg-white/10 p-2 text-white"><X size={18} /></button>
            </div>

          <div className="max-h-[calc(100dvh-205px)] overflow-y-auto px-3 py-3">
            {visibleSections.map((section) => (
              <section key={section.key} className="mb-4">
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{section.label}</p>
                <div className="space-y-1.5">
                  {section.items.map((item) => (
                    <button key={item.href} type="button" onClick={() => onNavigate?.(item.href)} className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left backdrop-blur-sm">
                      <span className="text-lg">{item.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-black text-white">{item.label}</span>
                        <span className="block truncate text-[11px] text-slate-300">{item.helper}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="shrink-0 border-t border-white/10 bg-slate-950/55 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3 backdrop-blur-xl">
            {profile ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[12px] font-black text-violet-700">
                    {getInitials(profile.name || profile.email)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-white">{profile.name || profile.email}</p>
                    <p className="truncate text-[11px] text-slate-300">{profile.email}</p>
                    <p className="text-[11px] text-violet-200">{normalizeRoleLabel(workspaceRole || profile.role)}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <button type="button" onClick={handleLogout} disabled={isLoggingOut} className="mt-2.5 flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-[13px] font-semibold text-slate-200 transition hover:border-red-300/50 hover:bg-red-500/15 hover:text-red-100">
              <span>{isLoggingOut ? 'Encerrando sessão...' : 'Sair da conta'}</span>
              <span aria-hidden="true" className="text-base leading-none">↗</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default function AdminShell({ pageTitle, children, mobileActions, activeItem = 'eventos', mobileSubtitle = '' }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  const visibleDrawerSections = useMemo(() => MOBILE_DRAWER_SECTIONS
    .map((section) => ({ ...section, items: section.items.filter((item) => allowedModules.has(item.module)) }))
    .filter((section) => section.items.length > 0), [allowedModules]);
  const mobileActiveItem = MOBILE_NAV_ALLOWED_ITEMS.has(activeItem) ? activeItem : 'mais';
  const isOnboardingRoute = ONBOARDING_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`));
  const forceTemplateGuide = pathname === '/contratos/templates' && (searchParams?.get('guide') === 'template' || searchParams?.get('onboarding') === 'template');
  const forceFreshWorkspaceTour = pathname === '/dashboard' && (
    searchParams?.get('onboarding') === 'fresh-workspace' || searchParams?.get('tour') === 'workspace-created'
  );

  useEffect(() => {
    if (initialized && !loading && !user && pathname !== '/login') {
      redirectToLogin();
    }
  }, [initialized, loading, pathname, user]);

  useEffect(() => {
    let active = true;

    async function loadTourEligibility() {
      try {
        if (forceTemplateGuide || forceFreshWorkspaceTour) {
          setShowTour(true);
          return;
        }

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
        if (active) window.setTimeout(() => setShowTour(false), 0);
      }
    }

    if (isOnboardingRoute || forceTemplateGuide || forceFreshWorkspaceTour) {
      loadTourEligibility();
    } else {
      const timer = window.setTimeout(() => setShowTour(false), 0);
      return () => {
        active = false;
        window.clearTimeout(timer);
      };
    }

    return () => {
      active = false;
    };
  }, [forceFreshWorkspaceTour, forceTemplateGuide, isOnboardingRoute, pathname, supabase]);

  if (initialized && !loading && !user) {
    return null;
  }

  const showDashboardOnboarding = pathname === '/dashboard';
  const showOperationalRouteOnboarding = (showTour || forceTemplateGuide) && pathname !== '/dashboard';

  return (
    <div className="min-h-screen bg-[#f4f6fa] text-[#111827]">
      <div className="hidden md:flex">
        <AdminSidebar activeItem={activeItem} />

        <main className="min-h-screen flex-1">
          <div className="mx-auto w-full max-w-[1440px] px-6 py-6">
            {showDashboardOnboarding ? (
              <DeferredOnboardingMount variant="dashboard" showTour={showTour} dashboardTimelineLimit={6} />
            ) : null}

            {showOperationalRouteOnboarding ? (
              <DeferredOnboardingMount variant="route" showTour={showTour || forceTemplateGuide} />
            ) : null}

            {children}
          </div>
        </main>
      </div>

      <div className="md:hidden">
        <AdminMobileTopbar title={pageTitle} subtitle={mobileSubtitle} actions={mobileActions} onOpenMenu={() => setMoreOpen(true)} />

        <main className="px-4 pb-28 pt-4">
          {showDashboardOnboarding ? (
            <DeferredOnboardingMount variant="dashboard" showTour={showTour} dashboardTimelineLimit={4} recommendationsLimit={2} />
          ) : null}

          {showOperationalRouteOnboarding ? (
            <DeferredOnboardingMount variant="route" showTour={showTour || forceTemplateGuide} />
          ) : null}

          {children}
        </main>

        <AdminBottomNav activeItem={mobileActiveItem} onOpenMore={() => setMoreOpen(true)} allowedModules={allowedModules} />

        <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} onNavigate={(href) => { setMoreOpen(false); router.push(href); }} visibleSections={visibleDrawerSections} workspaceRole={role || workspaceMe?.role} />
      </div>
    </div>
  );
}

export { MobileMoreSheet };
