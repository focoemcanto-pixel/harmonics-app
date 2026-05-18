'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { canStartOnboardingGuide, normalizeOnboardingGuide } from '@/lib/onboarding/onboarding-flow';
import { useOnboardingSession } from '@/contexts/OnboardingSessionContext';

const OnboardingFlowContext = createContext({
  status: null,
  loading: false,
  refresh: () => {},
});

function getGuideFromSearchParams(searchParams) {
  return normalizeOnboardingGuide(searchParams?.get('guide') || searchParams?.get('onboarding'));
}

function saveWorkspaceProgress(status) {
  if (typeof window === 'undefined' || !status?.workspaceId) return;
  try {
    window.localStorage.setItem(
      `harmonics:onboarding-flow:${status.workspaceId}`,
      JSON.stringify({
        currentStep: status.currentStep,
        nextStep: status.nextStep,
        nextHref: status.nextHref,
        demoEventId: status.demoEventId || null,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    // localStorage is best-effort only; server status remains the source of truth.
  }
}

export function OnboardingFlowProvider({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { hasCompetingOnboarding } = useOnboardingSession();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const guide = getGuideFromSearchParams(searchParams);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/onboarding/flow-status', { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.ok) {
        setStatus(payload);
        saveWorkspaceProgress(payload);
      }
    } catch (error) {
      console.warn('[ONBOARDING_FLOW][STATUS_ERROR]', error?.message || error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!guide) return;
    void refresh();
  }, [guide, pathname, refresh]);

  useEffect(() => {
    if (!guide || !status?.ok) return;

    const guard = canStartOnboardingGuide(status, guide);
    if (!guard.ok && guard.redirectHref && guard.redirectHref !== `${pathname}?${searchParams?.toString()}`) {
      router.replace(guard.redirectHref);
      return;
    }

    if (guard.ok && ['member-panel', 'member-panel-demo', 'automations', 'automation-overview', 'finance', 'admin-repertoire', 'dashboard-demo'].includes(guide)) {
      fetch('/api/onboarding/flow-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guide }),
      }).then(() => refresh()).catch((error) => {
        console.warn('[ONBOARDING_FLOW][MARK_GUIDE_ERROR]', error?.message || error);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide, pathname, router, searchParams, status?.hasContractTemplate, status?.ok]);

  useEffect(() => {
    if (!guide || !hasCompetingOnboarding?.(guide)) return;
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.delete('guide');
    params.delete('onboarding');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [guide, hasCompetingOnboarding, pathname, router, searchParams]);

  const value = useMemo(() => ({ status, loading, refresh }), [loading, refresh, status]);

  return (
    <OnboardingFlowContext.Provider value={value}>
      {children}
    </OnboardingFlowContext.Provider>
  );
}

export function useOnboardingFlow() {
  return useContext(OnboardingFlowContext);
}
