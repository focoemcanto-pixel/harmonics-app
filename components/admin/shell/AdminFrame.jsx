'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminTopbar from '@/components/admin/AdminTopbar';
import AdminMobileTopbar from '@/components/admin/AdminMobileTopbar';
import AdminBottomNav from '@/components/admin/AdminBottomNav';
import MobileMoreSheet from '@/components/admin/shell/MobileMoreSheet';
import CommandPalette from '@/components/admin/shell/CommandPalette';
import { AdminShellContext } from '@/components/admin/shell/AdminShellContext';
import DeferredOnboardingMount from '@/components/onboarding/DeferredOnboardingMount';
import { useAuth } from '@/contexts/AuthContext';
import { redirectToLogin } from '@/lib/auth/logoutRedirect';
import useWorkspaceMe from '@/hooks/useWorkspaceMe';
import useCurrentWorkspace from '@/hooks/useCurrentWorkspace';
import {
  ADMIN_MOBILE_PRIMARY_KEYS,
  ADMIN_NAV_SECTIONS,
  filterNavSections,
  findActiveChild,
  findActiveNavItem,
} from '@/lib/admin/navigation';

const CLIENT_PANEL_GUIDE_KEYS = ['harmonics:onboarding-tour:v1', 'harmonics:client-panel:onboarding'];
const SIDEBAR_PREF_KEY = 'harmonics:admin-sidebar-collapsed';

function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
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
  try {
    CLIENT_PANEL_GUIDE_KEYS.forEach((key) => {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    });
  } catch {
    // storage indisponível (aba privada/bloqueada) não deve quebrar a navegação.
  }
}

const SIDEBAR_PREF_EVENT = 'harmonics:admin-sidebar-pref';

function readSidebarPref() {
  try {
    return window.localStorage.getItem(SIDEBAR_PREF_KEY) === '1';
  } catch {
    return false;
  }
}

function subscribeSidebarPref(callback) {
  window.addEventListener(SIDEBAR_PREF_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(SIDEBAR_PREF_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function writeSidebarPref(collapsed) {
  try {
    window.localStorage.setItem(SIDEBAR_PREF_KEY, collapsed ? '1' : '0');
  } catch {
    // preferência visual apenas.
  }
  window.dispatchEvent(new Event(SIDEBAR_PREF_EVENT));
}

/**
 * Frame persistente do admin. Montado uma única vez em app/(admin)/layout.js: menu, topo,
 * navegação mobile, permissões do workspace e onboarding não são reconstruídos a cada tela.
 * As páginas continuam usando <AdminShell pageTitle=… mobileActions=…>, que só registra
 * esses dados aqui (ver components/layout/AdminShell.jsx).
 */
export default function AdminFrame({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, initialized, loading } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeSidebarPref, readSidebarPref, () => false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const [meta, setMetaState] = useState({});
  const contentRef = useRef(null);
  const prefetchedRef = useRef(new Map());

  const authReady = Boolean(initialized && !loading && user);
  const { workspaceMe, modules, role, loading: workspaceLoading, error: workspaceError } = useWorkspaceMe({ enabled: authReady });
  const { workspace, loading: currentWorkspaceLoading } = useCurrentWorkspace();

  const toggleCollapsed = useCallback(() => {
    writeSidebarPref(!readSidebarPref());
  }, []);

  // Fecha menus abertos ao trocar de tela (ajuste de estado durante a renderização).
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setMoreOpen(false);
    setSearchOpen(false);
  }

  // Usuário autenticado sem workspace (cadastro interrompido antes do bootstrap):
  // em vez de um painel vazio, retoma a criação do workspace.
  // Conta que só é músico/membro (sem membership administrativa): o lugar dela é o portal /membro.
  useEffect(() => {
    if (workspaceError?.code === 'MEMBER_ONLY') {
      router.replace('/membro');
      return;
    }
    if (workspaceError?.code === 'NO_WORKSPACE' && pathname !== '/workspace/new') {
      router.replace('/workspace/new');
    }
  }, [workspaceError, pathname, router]);

  // Assinatura só para workspaces de clientes (o interno da Harmonics não tem plano a contratar).
  const workspacePlanKey = String(workspaceMe?.workspace?.plan_key || workspace?.workspace?.plan_key || '').toLowerCase();
  const showClientBilling = Boolean(workspacePlanKey) && workspacePlanKey !== 'internal';

  const visibleSections = useMemo(
    () => filterNavSections({ modules, loading: workspaceLoading, showClientBilling }),
    [modules, workspaceLoading, showClientBilling]
  );
  const visibleItems = useMemo(() => visibleSections.flatMap((section) => section.items), [visibleSections]);
  const mobilePrimaryItems = useMemo(
    () => ADMIN_MOBILE_PRIMARY_KEYS.map((key) => visibleItems.find((item) => item.key === key)).filter(Boolean),
    [visibleItems]
  );
  const prefetchableAdminHrefs = useMemo(() => visibleItems.map((item) => item.href), [visibleItems]);

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

  const prefetch = useCallback((href) => {
    if (!href) return;
    const clean = stripClientPanelGuideFromHref(href);
    // Evita repetir o mesmo prefetch em sequência (hover/foco); o cache do roteador cuida do resto.
    const last = prefetchedRef.current.get(clean) || 0;
    if (Date.now() - last < 30000) return;
    prefetchedRef.current.set(clean, Date.now());
    try {
      router.prefetch(clean);
    } catch {
      // Prefetch é apenas otimização de navegação.
    }
  }, [router]);

  // Pré-carrega as telas do menu uma única vez por sessão (desktop), com a página já ociosa.
  useEffect(() => {
    if (!authReady || isClientPublicRoute || workspaceLoading || typeof window === 'undefined') return undefined;
    if (isMobileViewport()) return undefined;

    const run = () => prefetchableAdminHrefs.slice(0, 12).forEach(prefetch);
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 2500 });
      return () => window.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(run, 900);
    return () => window.clearTimeout(timer);
  }, [authReady, isClientPublicRoute, prefetch, prefetchableAdminHrefs, workspaceLoading]);

  useEffect(() => {
    if (typeof window === 'undefined' || isClientPublicRoute || !isClientPanelGuideParam) return;

    clearClientPanelGuideStorage();

    const current = new URL(window.location.href);
    current.searchParams.delete('guide');
    current.searchParams.delete('onboarding');
    current.searchParams.delete('returnTo');

    const cleanUrl = `${current.pathname}${current.search}${current.hash}` || '/dashboard';
    window.history.replaceState(null, '', cleanUrl);
    if (process.env.NODE_ENV !== 'production') console.debug('[ONBOARDING][GUIDE_PARAM_STRIPPED]', { cleanUrl });
    router.replace(cleanUrl, { scroll: false });
  }, [isClientPanelGuideParam, isClientPublicRoute, router, pathname, searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined' || isClientPublicRoute) return;
    clearClientPanelGuideStorage();
  }, [isClientPublicRoute, pathname]);

  // Tour guiado só quando pedido explicitamente pela URL (template de contrato ou workspace recém-criado).
  const showTour = !isClientPublicRoute && !isClientPanelGuideParam && (forceTemplateGuide || forceFreshWorkspaceTour);

  // Fecha menus e reanima a entrada do conteúdo a cada troca de tela, sem remontar a página.
  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    node.removeAttribute('data-hx-enter');
    void node.offsetWidth;
    node.setAttribute('data-hx-enter', 'true');
  }, [pathname]);

  // Atalho Ctrl/⌘+K para a busca rápida de telas.
  useEffect(() => {
    function handleKey(event) {
      if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleNavigate = useCallback((href) => {
    setMoreOpen(false);
    setSearchOpen(false);
    clearClientPanelGuideStorage();
    const cleanHref = stripClientPanelGuideFromHref(href);
    prefetch(cleanHref);
    router.push(cleanHref);
  }, [prefetch, router]);

  const setMeta = useCallback((next) => {
    setMetaState((current) => {
      const keys = ['pageTitle', 'mobileSubtitle', 'mobileActions', 'activeItem'];
      if (keys.every((key) => current[key] === next[key])) return current;
      return next;
    });
  }, []);

  const contextValue = useMemo(() => ({ setMeta }), [setMeta]);

  const activeItem = useMemo(() => findActiveNavItem(pathname), [pathname]);
  const activeChild = useMemo(() => findActiveChild(pathname, activeItem), [activeItem, pathname]);
  const activeSection = useMemo(
    () => ADMIN_NAV_SECTIONS.find((section) => section.items.some((item) => item.key === activeItem?.key)) || null,
    [activeItem]
  );
  const title = meta.pageTitle || activeItem?.label || 'Harmonics';
  const breadcrumbChild = activeChild && activeChild.href !== activeItem?.href ? activeChild.label : null;

  if (initialized && !loading && !user) {
    return null;
  }

  const showDashboardOnboarding = !isClientPanelGuideParam && pathname === '/dashboard';
  const showOperationalRouteOnboarding = !isClientPanelGuideParam && (showTour || forceTemplateGuide) && pathname !== '/dashboard';

  return (
    <AdminShellContext.Provider value={contextValue}>
      <div className="hx-admin min-h-[100dvh]">
        <div className="flex min-h-[100dvh]">
          <AdminSidebar
            sections={visibleSections}
            workspace={workspace}
            workspaceLoading={currentWorkspaceLoading}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            onPrefetch={prefetch}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <AdminTopbar
              sectionLabel={activeSection?.label}
              title={activeItem?.label || title}
              childLabel={breadcrumbChild}
              onOpenSearch={() => setSearchOpen(true)}
              role={role || workspaceMe?.role}
              workspaceName={workspace?.displayName}
            />
            <AdminMobileTopbar
              title={title}
              subtitle={meta.mobileSubtitle}
              actions={meta.mobileActions}
              workspaceName={workspace?.displayName}
              workspaceLoading={currentWorkspaceLoading}
              primaryColor={workspace?.primaryColor}
              onOpenSearch={() => setSearchOpen(true)}
            />

            <main
              id="admin-content"
              ref={contentRef}
              className="mx-auto w-full min-w-0 max-w-[1440px] overflow-x-clip px-4 pb-[calc(env(safe-area-inset-bottom,0px)+var(--hx-mobile-nav-h)+24px)] pt-4 md:px-6 md:pb-12 md:pt-2 lg:px-8"
            >
              {showDashboardOnboarding ? (
                <DeferredOnboardingMount variant="dashboard" showTour={showTour} dashboardTimelineLimit={6} />
              ) : null}

              {showOperationalRouteOnboarding ? (
                <DeferredOnboardingMount variant="route" showTour={showTour || forceTemplateGuide} />
              ) : null}

              {children}
            </main>
          </div>
        </div>

        <AdminBottomNav items={mobilePrimaryItems} onOpenMore={() => setMoreOpen(true)} moreActive={moreOpen} onPrefetch={prefetch} />
        <MobileMoreSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          onNavigate={handleNavigate}
          onPrefetch={prefetch}
          visibleSections={visibleSections}
          workspaceRole={role || workspaceMe?.role}
        />
        {searchOpen ? <CommandPalette
          open
          onClose={() => setSearchOpen(false)}
          sections={visibleSections}
          onNavigate={handleNavigate}
          onPrefetch={prefetch}
        /> : null}
      </div>
    </AdminShellContext.Provider>
  );
}

export { clearClientPanelGuideStorage, stripClientPanelGuideFromHref };
