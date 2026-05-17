'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { OnboardingSessionProvider } from '@/contexts/OnboardingSessionContext';

export default function AdminLayout({ children }) {
  return (
    <AuthProvider>
      <OnboardingSessionProvider>
        {children}
      </OnboardingSessionProvider>
    </AuthProvider>
  );
}
