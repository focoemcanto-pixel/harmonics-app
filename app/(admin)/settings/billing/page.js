import AdminShell from '@/components/layout/AdminShell';
import BillingClient from '@/components/settings/BillingClient';

export const metadata = {
  title: 'Assinatura | Harmonics',
};

export default function BillingSettingsPage() {
  return (
    <AdminShell pageTitle="Assinatura" activeItem="settings" mobileSubtitle="Plano e cobrança">
      <div className="mx-auto w-full max-w-6xl">
        <BillingClient />
      </div>
    </AdminShell>
  );
}
