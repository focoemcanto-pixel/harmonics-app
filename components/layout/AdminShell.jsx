'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import AdminSidebar from '../admin/AdminSidebar';
import AdminMobileTopbar from '../admin/AdminMobileTopbar';
import DeferredOnboardingMount from '@/components/onboarding/DeferredOnboardingMount';
import { useAuth } from '@/contexts/AuthContext';
import { redirectToLogin } from '@/lib/auth/logoutRedirect';
import useWorkspaceMe from '@/hooks/useWorkspaceMe';
import { getSupabase } from '@/lib/supabase';

const MOBILE_DRAWER_SECTIONS = [
  { key: 'operacional', label: 'OPERACIONAL', items: [{ module: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: '🏠', helper: 'Visão executiva' }, { module: 'eventos', label: 'Eventos', href: '/eventos', icon: '📅', helper: 'Próximas entregas' }, { module: 'escalas', label: 'Escalas', href: '/escalas', icon: '🎼', helper: 'Operação musical' }, { module: 'convites', label: 'Convites', href: '/convites', icon: '✉️', helper: 'Chamadas e respostas' }] },
  { key: 'comercial', label: 'COMERCIAL', items: [{ module: 'contratos', label: 'Contratos', href: '/contratos', icon: '📝', helper: 'Fluxo contratual' }, { module: 'contratos', label: 'Pré-contratos', href: '/pre-contratos', icon: '🔗', helper: 'Comercial inicial' }, { module: 'contratos', label: 'Templates de contrato', href: '/contratos/templates', icon: '📄', helper: 'Modelos oficiais' }, { module: 'pagamentos', label: 'Pagamentos', href: '/pagamentos', icon: '💳', helper: 'Receitas e custos' }] },
  { key: 'musical', label: 'MUSICAL', items: [{ module: 'repertorios', label: 'Repertórios', href: '/repertorios', icon: '🎧', helper: 'Biblioteca principal' }, { module: 'sugestoes', label: 'Sugestões', href: '/sugestoes', icon: '✨', helper: 'Ideias do cliente' }] },
  { key: 'equipe', label: 'EQUIPE', items: [{ module: 'contatos', label: 'Contatos', href: '/contatos', icon: '📇', helper: 'Rede e fornecedores' }] },
  { key: 'automacao', label: 'AUTOMAÇÃO', items: [{ module: 'automacoes', label: 'Automação', href: '/automacoes', icon: '⚡', helper: 'Fluxos e rotinas' }, { module: 'automacoes', label: 'Templates', href: '/automacoes/templates', icon: '📄', helper: 'Mensagens e ações' }, { module: 'automacoes', label: 'Logs', href: '/automacoes/logs', icon: '🧠', helper: 'Histórico de execução' }] },
  { key: 'sistema', label: 'SISTEMA', items: [{ module: 'eventos', label: 'Tipos de eventos', href: '/eventos/tipos', icon: '🧩', helper: 'Modelos e fluxos' }, { module: 'workspace', label: 'Configurações', href: '/settings', icon: '⚙️', helper: 'Conta e segurança' }, { module: 'workspace', label: 'Workspace', href: '/settings/workspace', icon: '🏢', helper: 'Marca e identidade' }] },
];

const ALL_MOBILE_DRAWER_MODULES = Array.from(
  new Set(
    MOBILE_DRAWER_SECTIONS.flatMap((section) =>
      section.items.map((item) => item.module).filter(Boolean)
    )
  )
);

const ONBOARDING_ROUTE_PREFIXES = ['/dashboard', '/eventos', '/pre-contratos', '/contratos/templates', '/automacoes', '/configuracoes/equipe', '/templates-escala', '/escalas/templates', '/pagamentos', '/repertorios'];
const CLIENT_PANEL_GUIDE_KEYS = ['harmonics:onboarding-tour:v1', 'harmonics:client-panel:onboarding'];

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

function stripClientPanelGuideFromHref(href) {
  if (!href) return href;
  try {
    const url = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'https://app.bandaharmonics.com');
    url.searchParams.delete('guide');
    url.searchParams.delete('onboarding');
    url.searchParams.delete('returnTo');
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href.split('?')[0] || href;
  }
}

function clearClientPanelGuideStorage() {
  if (typeof window === 'undefined') return;
  CLIENT_PANEL_GUIDE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  });
}

const MobileMoreSheet = memo(function MobileMoreSheet({ open, onClose, onNavigate, onPrefetch, visibleSections = [], workspaceRole }) {
  const { signOut, profile } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const isBusy = isLoggingOut || isNavigating;

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyTouchAction = document.body.style.touchAction;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.touchAction = previousBodyTouchAction;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setIsNavigating(false);
      return undefined;
    }

    function handleEscape(event) {
      if (event.key === 'Escape' && !isBusy) onClose?.();
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isBusy, open, onClose]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;

    const hrefs = visibleSections.flatMap((section) => section.items.map((item) => item.href)).filter(Boolean);
    const timer = window.setTimeout(() => {
      hrefs.forEach((href) => onPrefetch?.(href));
    }, 120);

    return () => window.clearTimeout(timer);
  }, [open, onPrefetch, visibleSections]);

  if (!open) return null;

  async function handleLogout() {
    if (isBusy) return;
    setIsLoggingOut(true);
    try {
      await signOut({ redirect: true });
      onClose?.();
    } finally {
      setIsLoggingOut(false);
    }
  }

  function handleNavigate(href) {
    if (isBusy) return;
    onPrefetch?.(href);
    setIsNavigating(true);
    onNavigate?.(href);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[190] bg-black/55 backdrop-blur-md md:hidden"
      onClick={(e) => e.target === e.currentTarget && !isBusy && onClose?.()}
    >
      <div className="flex h-[100dvh] items-stretch justify-start pt-[env(safe-area-inset-top,0px)]">
        <div
          className="flex h-[calc(100dvh-env(safe-area-inset-top,0px))] w-[86vw] max-w-[370px] flex-col overflow-hidden overscroll-contain border-r border-white/10 bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] shadow-[30px_0_80px_rgba(15,23,42,0.55)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-200">Navegação</div>
              <div className="mt-1 truncate text-[20px] font-black tracking-[-0.03em] text-white">Workspace operacional</div>
            </div>

            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => !isBusy && onClose?.()}
              disabled={isBusy}
              className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full border border-white/20 bg-white/10 p-2 text-white transition active:scale-[0.98] disabled:opacity-60"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2.5 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]">
            {visibleSections.map((section) => (
              <section key={section.key} className="mb-3.5">
                <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{section.label}</p>
                <div className="space-y-1.5">
                  {section.items.map((item) => (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => handleNavigate(item.href)}
                      onPointerEnter={() => onPrefetch?.(item.href)}
                      onFocus={() => onPrefetch?.(item.href)}
                      disabled={isBusy}
                      className="flex min-h-14 w-full touch-manipulation items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left backdrop-blur-sm transition active:scale-[0.99] disabled:opacity-60"
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-black text-white">{item.label}</span>
                        <span className="block truncate text-[11px] text-slate-300">{item.helper}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="sticky bottom-0 shrink-0 border-t border-white/10 bg-slate-950/70 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-2.5 backdrop-blur-xl">
            {profile ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[12px] font-black text-violet-700">
                    {getInitials(profile.name || profile.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-white">{profile.name || profile.email}</p>
                    <p className="truncate text-[11px] text-slate-300">{profile.email}</p>
                    <p className="truncate text-[11px] text-violet-200">{normalizeRoleLabel(workspaceRole || profile.role)}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleLogout}
              disabled={isBusy}
              className="mt-2 flex min-h-11 w-full touch-manipulation items-center justify-between rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2.5 text-[13px] font-semibold text-slate-200 transition active:scale-[0.99] hover:border-red-300/50 hover:bg-red-500/15 hover:text-red-100 disabled:opacity-60"
            >
              <span>{isLoggingOut ? 'Encerrando sessão...' : isNavigating ? 'Abrindo...' : 'Sair da conta'}</span>
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
  const {
    workspaceMe,
    modules,
    role,
    loading: workspaceLoading,
  } = useWorkspaceMe({ enabled: Boolean(initialized && !loading && user) });

  const allowedModules = useMemo(() => {
    if (workspaceLoading) {
      return new Set(ALL_MOBILE_DRAWER_MODULES);
    }

    if (Array.isArray(modules) && modules.length > 0) {
      return new Set([...modules, 'workspace']);
    }

    return new Set(['dashboard', 'workspace']);
  }, [modules, workspaceLoading]);

  const visibleDrawerSections = useMemo(() => MOBILE_DRAWER_SECTIONS
    .map((section) => ({ ...section, items: section.items.filter((item) => allowedModules.has(item.module)) }))
    .filter((section) => section.items.length > 0), [allowedModules]);
  const prefetchableAdminHrefs = useMemo(() => Array.from(new Set(
    visibleDrawerSections.flatMap((section) => section.items.map((item) => stripClientPanelGuideFromHref(item.href))).filter(Boolean)
  )), [visibleDrawerSections]);
  const isOnboardingRoute = ONBOARDING_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`));
  const isClientPublicRoute = pathname?.startsWith('/cliente/') || pathname?.startsWith('/contrato/');
  const isClientPanelGuideParam = searchParams?.get('guide') === 'client-panel' || searchParams?.get('onboarding') === 'client-panel';
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
    if (!initialized || loading || !user || isClientPublicRoute || typeof window === 'undefined') return undefined;

    const timer = window.setTimeout(() => {
      prefetchableAdminHrefs.slice(0, 12).forEach((href) => {
        try {
          router.prefetch(href);
        } catch {
          // Prefetch é uma melhoria progressiva; falhas não devem impactar a navegação.
        }
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [initialized, isClientPublicRoute, loading, prefetchableAdminHrefs, router, user]);

  useEffect(() => {
    if (typeof window === 'undefined' || isClientPublicRoute || !isClientPanelGuideParam) return;

    clearClientPanelGuideStorage();
    const hideTourTimer = window.setTimeout(() => setShowTour(false), 0);

    const current = new URL(window.location.href);
    current.searchParams.delete('guide');
    current.searchParams.delete('onboarding');
    current.searchParams.delete('returnTo');

    const cleanUrl = `${current.pathname}${current.search}${current.hash}` || '/dashboard';
    window.history.replaceState(null, '', cleanUrl);
    router.replace(cleanUrl, { scroll: false });

    return () => window.clearTimeout(hideTourTimer);
  }, [isClientPanelGuideParam, isClientPublicRoute, router, pathname, searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined' || isClientPublicRoute) return;
    clearClientPanelGuideStorage();
  }, [isClientPublicRoute, pathname]);

  useEffect(() => {
    let active = true;

    async function loadTourEligibility() {
      try {
        if (isClientPanelGuideParam && !isClientPublicRoute) {
          setShowTour(false);
          return;
        }

        if (forceTemplateGuide || forceFreshWorkspaceTour) {
          setShowTour(true);
          return;
        }

        if (!supabase?.auth) {
          if (active) window.setTimeout(() => setShowTour(false), 0);
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

    if (!isClientPublicRoute && !isClientPanelGuideParam && (isOnboardingRoute || forceTemplateGuide || forceFreshWorkspaceTour)) {
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
  }, [forceFreshWorkspaceTour, forceTemplateGuide, isClientPanelGuideParam, isClientPublicRoute, isOnboardingRoute, pathname, supabase]);

  if (initialized && !loading && !user) {
    return null;
  }

  const showDashboardOnboarding = !isClientPanelGuideParam && pathname === '/dashboard';
  const showOperationalRouteOnboarding = !isClientPanelGuideParam && (showTour || forceTemplateGuide) && pathname !== '/dashboard';

  function handleAdminPrefetch(href) {
    if (!href) return;

    try {
      router.prefetch(stripClientPanelGuideFromHref(href));
    } catch {
      // Prefetch é apenas otimização de navegação.
    }
  }

  function handleAdminNavigate(href) {
    setMoreOpen(false);
    clearClientPanelGuideStorage();
    const cleanHref = stripClientPanelGuideFromHref(href);
    handleAdminPrefetch(cleanHref);
    router.push(cleanHref);
  }

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

        <main className="overflow-x-clip px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4">
          {showDashboardOnboarding ? (
            <DeferredOnboardingMount variant="dashboard" showTour={showTour} dashboardTimelineLimit={4} recommendationsLimit={2} />
          ) : null}

          {showOperationalRouteOnboarding ? (
            <DeferredOnboardingMount variant="route" showTour={showTour || forceTemplateGuide} />
          ) : null}

          {children}
        </main>

        <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} onNavigate={handleAdminNavigate} onPrefetch={handleAdminPrefetch} visibleSections={visibleDrawerSections} workspaceRole={role || workspaceMe?.role} />
      </div>
    </div>
  );
}

export { MobileMoreSheet };
