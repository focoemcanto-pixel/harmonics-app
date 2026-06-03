'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useOnboardingSession } from '@/contexts/OnboardingSessionContext';

const DashboardOnboardingBanner = dynamic(() => import('@/components/onboarding/DashboardOnboardingBanner'), { ssr: false, loading: () => null });
const WorkspaceInsightCard = dynamic(() => import('@/components/workspace/WorkspaceInsightCard'), { ssr: false, loading: () => null });
const WorkspaceRecommendationsFeed = dynamic(() => import('@/components/workspace/WorkspaceRecommendationsFeed'), { ssr: false, loading: () => null });
const WorkspaceActivityTimeline = dynamic(() => import('@/components/workspace/WorkspaceActivityTimeline'), { ssr: false, loading: () => null });
const OperationalRouteOnboarding = dynamic(() => import('@/components/onboarding/OperationalRouteOnboarding'), { ssr: false, loading: () => null });
const SectionGuidedOnboarding = dynamic(() => import('@/components/onboarding/SectionGuidedOnboarding'), { ssr: false, loading: () => null });
const OnboardingTourOverlay = dynamic(() => import('@/components/onboarding/OnboardingTourOverlay'), { ssr: false, loading: () => null });
const FreshWorkspaceStartGuide = dynamic(() => import('@/components/onboarding/FreshWorkspaceStartGuide'), { ssr: false, loading: () => null });
const TemplateCreationGuideStable = dynamic(() => import('@/components/onboarding/TemplateCreationGuideStable'), { ssr: false, loading: () => null });
const EventTypeTemplateGuideStable = dynamic(() => import('@/components/onboarding/EventTypeTemplateGuideStable'), { ssr: false, loading: () => null });
const PrecontractGuideStable = dynamic(() => import('@/components/onboarding/PrecontractGuideStableV2'), { ssr: false, loading: () => null });
const OnboardingPrerequisiteGate = dynamic(() => import('@/components/onboarding/OnboardingPrerequisiteGate'), { ssr: false, loading: () => null });

const GUIDE_KEYS = [
  'template',
  'event',
  'event-types',
  'precontract',
  'fake-members',
  'formation-template',
  'scale',
  'member-panel',
  'member-panel-demo',
  'automations',
  'automation-overview',
  'finance',
  'admin-repertoire',
  'dashboard-demo',
  'cleanup-fake-event',
  'scale-with-formation',
];

function isClientPublicRoute(pathname = '') {
  return pathname?.startsWith('/cliente/') || pathname?.startsWith('/contrato/');
}

export default function DeferredOnboardingMount({
  variant,
  showTour = false,
  dashboardTimelineLimit = 6,
  recommendationsLimit,
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [onboardingEnabled, setOnboardingEnabled] = useState(false);
  const [primaryWorkspace, setPrimaryWorkspace] = useState(false);
  const [loadingEligibility, setLoadingEligibility] = useState(true);
  const { onboardingSession } = useOnboardingSession();

  const requestedGuide = useMemo(() => {
    if (!isClientPublicRoute(pathname)) {
      const rawGuide = searchParams?.get('guide');
      const rawOnboarding = searchParams?.get('onboarding');
      if (rawGuide === 'client-panel' || rawOnboarding === 'client-panel') return null;
    }
    const guideQuery = searchParams?.get('guide');
    const onboardingQuery = searchParams?.get('onboarding');
    return guideQuery || onboardingQuery;
  }, [pathname, searchParams]);

  const manualGuideRequested = GUIDE_KEYS.includes(requestedGuide);
  const freshWorkspace = requestedGuide === 'fresh-workspace' || searchParams?.get('tour') === 'workspace-created';

  useEffect(() => {
    // On mobile Safari/Instagram webview, requestIdleCallback can delay the guide long enough
    // to make onboarding look broken. Manual guide URLs must mount immediately.
    if (manualGuideRequested || freshWorkspace) {
      setMounted(true);
      return undefined;
    }

    const timer = window.setTimeout(() => setMounted(true), 80);
    return () => window.clearTimeout(timer);
  }, [manualGuideRequested, freshWorkspace]);

  useEffect(() => {
    let active = true;

    async function loadEligibility() {
      try {
        const response = await fetch('/api/onboarding/flow-status', {
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          if (active) {
            setOnboardingEnabled(false);
            setPrimaryWorkspace(false);
            setLoadingEligibility(false);
          }
          return;
        }

        const data = await response.json();
        const enabled = data?.onboardingEnabled === true;
        const isPrimary = data?.primaryWorkspace === true;

        if (process.env.NODE_ENV !== 'production') {
          console.debug('[ONBOARDING][DeferredOnboardingMount]', {
            workspaceId: data?.workspaceId || null,
            onboardingEnabled: enabled,
            primaryWorkspace: isPrimary,
            requestedGuide: requestedGuide || null,
            reason: enabled ? 'flow-status-enabled' : 'flow-status-disabled',
            path: pathname || null,
          });
        }

        if (active) {
          setOnboardingEnabled(enabled);
          setPrimaryWorkspace(isPrimary);
          setLoadingEligibility(false);
        }
      } catch {
        if (active) {
          setOnboardingEnabled(false);
          setPrimaryWorkspace(false);
          setLoadingEligibility(false);
        }
      }
    }

    if (mounted) loadEligibility();

    return () => {
      active = false;
    };
  }, [mounted, pathname, requestedGuide]);

  if (!mounted || loadingEligibility) return null;

  // Do not suppress explicit guide URLs. This is essential for mobile and for "Reabrir etapa".
  if (primaryWorkspace && !manualGuideRequested && !freshWorkspace) return null;

  const canRenderOnboarding = onboardingEnabled || manualGuideRequested || freshWorkspace;
  if (!canRenderOnboarding) return null;

  const hasDynamicGuideQuery = manualGuideRequested;
  const isGuideActive = Boolean(onboardingSession.activeGuide) || hasDynamicGuideQuery;
  const shouldRenderVisualTour = showTour || freshWorkspace;

  if (variant === 'dashboard') {
    return (
      <>
        {freshWorkspace && !isGuideActive ? <FreshWorkspaceStartGuide /> : null}
        {shouldRenderVisualTour && !isGuideActive ? (
          <OnboardingTourOverlay force={freshWorkspace} />
        ) : null}
        {!isGuideActive ? <div className="mb-5"><DashboardOnboardingBanner /></div> : null}
        <div className="mb-5"><WorkspaceInsightCard /></div>
        {!isGuideActive ? <div className="mb-5"><WorkspaceRecommendationsFeed limit={recommendationsLimit} /></div> : null}
        <div className="mb-5"><WorkspaceActivityTimeline limit={dashboardTimelineLimit} compact /></div>
      </>
    );
  }

  if (variant === 'route') {
    const routeGuides = (
      <>
        {showTour && !isGuideActive ? <OnboardingTourOverlay /> : null}
        {!isGuideActive ? <OperationalRouteOnboarding enabled /> : null}
        {!isGuideActive ? <SectionGuidedOnboarding enabled /> : null}
        {pathname === '/contratos/templates' && (!isGuideActive || requestedGuide === 'template' || onboardingSession.activeGuide === 'template') ? <TemplateCreationGuideStable enabled /> : null}
        {pathname === '/eventos/tipos' && (!isGuideActive || requestedGuide === 'event-types' || onboardingSession.activeGuide === 'event-types') ? <EventTypeTemplateGuideStable enabled /> : null}
        {pathname === '/pre-contratos' && (!isGuideActive || requestedGuide === 'precontract' || onboardingSession.activeGuide === 'precontract') ? <PrecontractGuideStable enabled /> : null}
      </>
    );

    if (pathname === '/eventos/tipos') return <OnboardingPrerequisiteGate requiredStep="event_type">{routeGuides}</OnboardingPrerequisiteGate>;
    if (pathname === '/pre-contratos') return <OnboardingPrerequisiteGate requiredStep="precontract">{routeGuides}</OnboardingPrerequisiteGate>;
    return routeGuides;
  }

  return shouldRenderVisualTour && !isGuideActive ? <OnboardingTourOverlay force={freshWorkspace} /> : null;
}
