import AdminShell from '@/components/admin/AdminShell';
import AvaliacoesPageClient from '@/components/avaliacoes/AvaliacoesPageClient';

export default function AvaliacoesPage() {
  return (
    <AdminShell pageTitle="Depoimentos Premium" activeItem="avaliacoes">
      <AvaliacoesPageClient />
    </AdminShell>
  );
}
