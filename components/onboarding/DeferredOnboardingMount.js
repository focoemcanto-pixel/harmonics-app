'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

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

export default function DeferredOnboardingMount({
  variant,
  showTour = false,
  dashboardTimelineLimit = 6,
  recommendationsLimit,
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

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

  const freshWorkspace = searchParams?.get('onboarding') === 'fresh-workspace' || searchParams?.get('tour') === 'workspace-created';

  if (variant === 'dashboard') {
    return (
      <>
        {showTour ? <OnboardingTourOverlay force={freshWorkspace} onFinishHref={freshWorkspace ? '/contratos/templates?guide=template' : null} finalLabel={freshWorkspace ? 'Continuar' : 'Concluir'} /> : null}
        <div className="mb-5"><DashboardOnboardingBanner /></div>
        <div className="mb-5"><WorkspaceInsightCard /></div>
        <div className="mb-5"><WorkspaceRecommendationsFeed limit={recommendationsLimit} /></div>
        <div className="mb-5"><WorkspaceActivityTimeline limit={dashboardTimelineLimit} compact /></div>
      </>
    );
  }

  if (variant === 'route') {
    return (
      <>
        {showTour ? <OnboardingTourOverlay /> : null}
        <OperationalRouteOnboarding enabled />
        <SectionGuidedOnboarding enabled />
        {pathname === '/contratos/templates' ? <TemplateCreationGuideStable enabled /> : null}
        {pathname === '/eventos/tipos' ? <EventTypeTemplateGuideStable enabled /> : null}
        {pathname === '/pre-contratos' ? <PrecontractGuideStable enabled /> : null}
      </>
    );
  }

  return showTour ? <OnboardingTourOverlay /> : null;
}
