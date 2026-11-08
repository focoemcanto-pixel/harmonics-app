import AdminShell from '@/components/layout/AdminShell';
import ProtectedRoute from '@/components/ProtectedRoute';
import CommercialIntelligenceClient from '@/components/inbox/CommercialIntelligenceClient';

export default function CommercialIntelligencePage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminShell pageTitle="Inteligência Comercial" activeItem="inbox">
        <CommercialIntelligenceClient />
      </AdminShell>
    </ProtectedRoute>
  );
}
