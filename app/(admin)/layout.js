import { Suspense } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { OnboardingSessionProvider } from '@/contexts/OnboardingSessionContext';
import { OnboardingFlowProvider } from '@/components/onboarding/OnboardingFlowProvider';
import AdminFrame from '@/components/admin/shell/AdminFrame';
import AppShellSkeleton from '@/components/layout/AppShellSkeleton';

// Barra de status do navegador/PWA no tom claro do painel (a landing segue escura).
export const viewport = {
  themeColor: '#eef0f4',
};

// O frame do admin fica no layout: persiste entre as trocas de tela (sem remontar menu,
// permissões do workspace e onboarding a cada navegação).
export default function AdminLayout({ children }) {
  return (
    <AuthProvider>
      <OnboardingSessionProvider>
        <OnboardingFlowProvider>
          <Suspense fallback={<AppShellSkeleton label="Abrindo painel" />}>
            <AdminFrame>{children}</AdminFrame>
          </Suspense>
        </OnboardingFlowProvider>
      </OnboardingSessionProvider>
    </AuthProvider>
  );
}
