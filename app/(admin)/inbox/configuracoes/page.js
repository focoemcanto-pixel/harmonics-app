import AdminShell from '@/components/layout/AdminShell';
import ProtectedRoute from '@/components/ProtectedRoute';
import InboxSettingsClient from '@/components/inbox/InboxSettingsClient';

export default function InboxSettingsPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminShell pageTitle="IA e WhatsApp oficial" activeItem="inbox">
        <InboxSettingsClient />
      </AdminShell>
    </ProtectedRoute>
  );
}
