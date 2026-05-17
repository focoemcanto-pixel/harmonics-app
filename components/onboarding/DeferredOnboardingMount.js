'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useOnboardingSession } from '@/contexts/OnboardingSessionContext';

const DashboardOnboardingBanner = dynamic(() => import('@/components/onboarding/DashboardOnboardingBanner'), {
  ssr: false,
  loading: () => null,
});

const WorkspaceInsightCard = dynamic(() => import('@/components/workspace/WorkspaceInsightCard'), {
  ssr: false,
  loading: () => null,
});

const WorkspaceRecommendationsFeed = dynamic(() => import('@/components/workspace/WorkspaceRecommendationsFeed'), {
  ssr: false,
  loading: () => null,
});

const WorkspaceActivityTimeline = dynamic(() => import('@/components/workspace/WorkspaceActivityTimeline'), {
  ssr: false,
  loading: () => null,
});

const OperationalRouteOnboarding = dynamic(() => import('@/components/onboarding/OperationalRouteOnboarding'), {
  ssr: false,
  loading: () => null,
});

const SectionGuidedOnboarding = dynamic(() => import('@/components/onboarding/SectionGuidedOnboarding'), {
  ssr: false,
  loading: () => null,
});

const OnboardingTourOverlay = dynamic(() => import('@/components/onboarding/OnboardingTourOverlay'), {
  ssr: false,
  loading: () => null,
});

const TemplateCreationGuideStable = dynamic(() => import('@/components/onboarding/TemplateCreationGuideStable'), {
  ssr: false,
  loading: () => null,
});

const EventTypeTemplateGuideStable = dynamic(() => import('@/components/onboarding/EventTypeTemplateGuideStable'), {
  ssr: false,
  loading: () => null,
});

const PrecontractGuideStable = dynamic(() => import('@/components/onboarding/PrecontractGuideStableV2'), {
  ssr: false,
  loading: () => null,
});

const OnboardingPrerequisiteGate = dynamic(() => import('@/components/onboarding/OnboardingPrerequisiteGate'), {
  ssr: false,
  loading: () => null,
});

export default function DeferredOnboardingMount({
  variant,
  showTour = false,
  dashboardTimelineLimit = 6,
  recommendationsLimit,
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const { onboardingSession } = useOnboardingSession();

  useEffect(() => {
    let timer;

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(() => setMounted(true), { timeout: 1200 });
      return () => window.cancelIdleCallback?.(idleId);
    }

    timer = window.setTimeout(() => setMounted(true), 350);
    return () => window.clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  const guideQuery = searchParams?.get('guide');
  const onboardingQuery = searchParams?.get('onboarding');
  const requestedGuide = guideQuery || onboardingQuery;
  const hasDynamicGuideQuery = ['template', 'event-types', 'precontract'].includes(requestedGuide);
  const isGuideActive = Boolean(onboardingSession.activeGuide) || hasDynamicGuideQuery;
  const freshWorkspace = onboardingQuery === 'fresh-workspace' || searchParams?.get('tour') === 'workspace-created';

  if (variant === 'dashboard') {
    return (
      <>
        {showTour && !isGuideActive ? <OnboardingTourOverlay force={freshWorkspace} onFinishHref={freshWorkspace ? '/contratos/templates?guide=template' : null} finalLabel={freshWorkspace ? 'Continuar' : 'Concluir'} /> : null}
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

    if (pathname === '/eventos/tipos') {
      return <OnboardingPrerequisiteGate requiredStep="event_type">{routeGuides}</OnboardingPrerequisiteGate>;
    }

    if (pathname === '/pre-contratos') {
      return <OnboardingPrerequisiteGate requiredStep="precontract">{routeGuides}</OnboardingPrerequisiteGate>;
    }

    return routeGuides;
  }

  return showTour && !isGuideActive ? <OnboardingTourOverlay /> : null;
}
