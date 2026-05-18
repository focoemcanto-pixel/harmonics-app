'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const IDLE_SESSION = {
  activeGuide: null,
  activeOverlay: null,
  mode: 'idle',
};

const OnboardingSessionContext = createContext({
  onboardingSession: IDLE_SESSION,
  startOnboardingSession: () => false,
  endOnboardingSession: () => {},
  isOnboardingOwner: () => false,
  hasCompetingOnboarding: () => false,
});

export function OnboardingSessionProvider({ children }) {
  const [onboardingSession, setOnboardingSession] = useState(IDLE_SESSION);
  const activeOwnerRef = useRef(null);

  const startOnboardingSession = useCallback(({ guide = null, overlay = null, mode = 'guide' } = {}) => {
    const owner = overlay || guide;
    if (!owner) return false;

    const currentOwner = activeOwnerRef.current;
    if (currentOwner && currentOwner !== owner) return false;
    activeOwnerRef.current = owner;

    setOnboardingSession((current) => {
      const stateOwner = current.activeOverlay || current.activeGuide;
      if (stateOwner && stateOwner !== owner) return current;

      return {
        activeGuide: guide ?? current.activeGuide,
        activeOverlay: overlay || current.activeOverlay || owner,
        mode,
      };
    });

    return true;
  }, []);

  const endOnboardingSession = useCallback((owner) => {
    if (!owner) return;

    setOnboardingSession((current) => {
      const currentOwner = current.activeOverlay || current.activeGuide;
      if (currentOwner && currentOwner !== owner) return current;
      activeOwnerRef.current = null;
      return IDLE_SESSION;
    });
  }, []);

  const isOnboardingOwner = useCallback((owner) => {
    if (!owner) return false;
    return onboardingSession.activeGuide === owner || onboardingSession.activeOverlay === owner;
  }, [onboardingSession.activeGuide, onboardingSession.activeOverlay]);

  const hasCompetingOnboarding = useCallback((owner) => {
    const currentOwner = onboardingSession.activeOverlay || onboardingSession.activeGuide;
    return Boolean(currentOwner && currentOwner !== owner);
  }, [onboardingSession.activeGuide, onboardingSession.activeOverlay]);

  const value = useMemo(() => ({
    onboardingSession,
    startOnboardingSession,
    endOnboardingSession,
    isOnboardingOwner,
    hasCompetingOnboarding,
  }), [endOnboardingSession, hasCompetingOnboarding, isOnboardingOwner, onboardingSession, startOnboardingSession]);

  return (
    <OnboardingSessionContext.Provider value={value}>
      {children}
    </OnboardingSessionContext.Provider>
  );
}

export function useOnboardingSession() {
  return useContext(OnboardingSessionContext);
}

export function useHasActiveGuide() {
  const { onboardingSession } = useOnboardingSession();
  return Boolean(onboardingSession.activeGuide);
}
