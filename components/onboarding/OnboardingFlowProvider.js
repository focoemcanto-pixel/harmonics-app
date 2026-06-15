'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { canStartOnboardingGuide, normalizeOnboardingGuide } from '@/lib/onboarding/onboarding-flow';
import { useOnboardingSession } from '@/contexts/OnboardingSessionContext';

const OnboardingFlowContext = createContext({
  status: null,
  loading: false,
  refresh: () => {},
});
const HARMONICS_PRIMARY_WORKSPACE_ID = 'f36dcd9b-22a9-487a-bf2e-691d17bd6294';

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

function devLog(label, payload) {
  if (process.env.NODE_ENV !== 'production') console.debug(label, payload || {});
}

function currentRelativeUrl(pathname, searchParams) {
  const query = searchParams?.toString?.() || '';
  return query ? `${pathname}?${query}` : pathname;
}

function sameHref(a, b) {
  if (!a || !b) return false;
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.bandaharmonics.com';
    const left = new URL(a, origin);
    const right = new URL(b, origin);
    return `${left.pathname}${left.search}` === `${right.pathname}${right.search}`;
  } catch {
    return a === b;
  }
}

function isExplicitOnboardingEntry(pathname, searchParams) {
  const onboarding = normalizeOnboardingGuide(searchParams?.get('onboarding'));
  const tour = normalizeOnboardingGuide(searchParams?.get('tour'));
  const guide = normalizeOnboardingGuide(searchParams?.get('guide'));

  if (pathname === '/dashboard' && (onboarding === 'fresh-workspace' || tour === 'workspace-created')) return true;
  if (guide && guide !== 'client-panel') return true;
  if (onboarding && onboarding !== 'client-panel') return true;
  return false;
}

export function OnboardingFlowProvider({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { hasCompetingOnboarding } = useOnboardingSession();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const lastFetchKeyRef = useRef(null);
  const guide = getGuideFromSearchParams(searchParams);
  const explicitOnboardingEntry = isExplicitOnboardingEntry(pathname, searchParams);

  const refresh = useCallback(async ({ force = false } = {}) => {
    if (!force && !explicitOnboardingEntry && !status?.ok) return;
    const fetchKey = `${pathname || ''}?${searchParams?.toString?.() || ''}`;
    if (!force && lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;
    setLoading(true);
    devLog('[ONBOARDING][FETCH_STATUS_START]', { pathname, explicitOnboardingEntry });
    try {
      const response = await fetch('/api/onboarding/flow-status', { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.ok) {
        setStatus(payload);
        saveWorkspaceProgress(payload);
        devLog('[ONBOARDING][FETCH_STATUS_SUCCESS]', { workspaceId: payload.workspaceId, primaryWorkspace: payload.primaryWorkspace, onboardingEnabled: payload.onboardingEnabled, completed: payload.completed, skipped: payload.skipped });
      }
    } catch (error) {
      devLog('[ONBOARDING][FETCH_STATUS_ERROR]', { message: error?.message || String(error) });
    } finally {
      setLoading(false);
    }
  }, [explicitOnboardingEntry, pathname, searchParams, status?.ok]);

  useEffect(() => {
    devLog('[ONBOARDING][MOUNT]', { pathname, explicitOnboardingEntry });
    if (!explicitOnboardingEntry) return;
    void refresh({ force: true });
  }, [explicitOnboardingEntry, pathname, refresh]);

  useEffect(() => {
    if (guide || !status?.ok) return;
    const currentUrl = currentRelativeUrl(pathname, searchParams);
    const blockedReason = !explicitOnboardingEntry
      ? 'not-explicit'
      : status.workspaceId === HARMONICS_PRIMARY_WORKSPACE_ID || status.primaryWorkspace === true
        ? 'primary-workspace'
        : status.completed === true
          ? 'completed'
          : status.skipped === true
            ? 'skipped'
            : !status.onboardingEnabled
              ? 'disabled'
              : !status.nextHref
                ? 'missing-nextHref'
                : hasCompetingOnboarding?.()
                  ? 'competing-onboarding'
                  : sameHref(status.nextHref, currentUrl)
                    ? 'same-url'
                    : null;
    if (blockedReason) {
      if (blockedReason === 'primary-workspace') devLog('[ONBOARDING][SKIP_PRIMARY_WORKSPACE]', { workspaceId: status.workspaceId });
      devLog('[ONBOARDING][AUTO_REDIRECT_BLOCKED]', { reason: blockedReason, nextHref: status.nextHref || null, currentUrl });
      return;
    }
    devLog('[ONBOARDING][AUTO_REDIRECT_ALLOWED]', { nextHref: status.nextHref, currentUrl });
    router.replace(status.nextHref);
  }, [explicitOnboardingEntry, guide, hasCompetingOnboarding, pathname, router, searchParams, status]);

  useEffect(() => {
    if (!guide || !status?.ok) return;

    const guard = canStartOnboardingGuide(status, guide);
    const currentUrl = currentRelativeUrl(pathname, searchParams);
    if (!guard.ok && guard.redirectHref && !sameHref(guard.redirectHref, currentUrl) && explicitOnboardingEntry && status.primaryWorkspace !== true) {
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
