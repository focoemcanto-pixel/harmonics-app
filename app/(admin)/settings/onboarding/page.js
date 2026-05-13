import AdminShell from '@/components/admin/AdminShell';
import OnboardingChecklistClient from '@/components/onboarding/OnboardingChecklistClient';

export const metadata = {
  title: 'Onboarding | Harmonics',
};

export default function OnboardingPage() {
  return (
    <AdminShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <OnboardingChecklistClient />
      </div>
    </AdminShell>
  );
}
