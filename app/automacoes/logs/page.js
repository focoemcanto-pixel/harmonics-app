import AdminShell from '@/components/layout/AdminShell';
import LogsPageClient from '@/components/automacoes/LogsPageClient';

export default function LogsPage() {
  return (
    <AdminShell pageTitle="Logs de Automação" activeItem="automacoes">
      <LogsPageClient />
    </AdminShell>
  );
}
