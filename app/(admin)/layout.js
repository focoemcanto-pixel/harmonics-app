'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { OnboardingSessionProvider } from '@/contexts/OnboardingSessionContext';
import { OnboardingFlowProvider } from '@/components/onboarding/OnboardingFlowProvider';

export default function AdminLayout({ children }) {
  return (
    <AuthProvider>
      <OnboardingSessionProvider>
        <OnboardingFlowProvider>{children}</OnboardingFlowProvider>
      </OnboardingSessionProvider>
    </AuthProvider>
  );
}
