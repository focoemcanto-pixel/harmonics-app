import AdminShell from '@/components/admin/AdminShell';
import AvaliacoesPageClient from '@/components/avaliacoes/AvaliacoesPageClient';

export default function AvaliacoesPage() {
  return (
    <AdminShell pageTitle="Avaliações" activeItem="avaliacoes">
      <AvaliacoesPageClient />
    </AdminShell>
  );
}
