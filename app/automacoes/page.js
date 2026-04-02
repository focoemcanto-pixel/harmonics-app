import AdminShell from '@/components/layout/AdminShell';
import AutomacoesPageClient from '@/components/automacoes/AutomacoesPageClient';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function AutomacoesPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminShell pageTitle="Central de Automação" activeItem="automacoes">
        <AutomacoesPageClient />
      </AdminShell>
    </ProtectedRoute>
  );
}
