import AdminShell from '@/components/layout/AdminShell';
import AutomacoesPageClient from '@/components/automacoes/AutomacoesPageClient';

export default function AutomacoesPage() {
  return (
    <AdminShell pageTitle="Central de Automação" activeItem="automacoes">
      <AutomacoesPageClient />
    </AdminShell>
  );
}
