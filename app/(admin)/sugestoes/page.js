import AdminShell from '@/components/admin/AdminShell';
import SuggestoesPageClient from '@/components/sugestoes/SuggestoesPageClient';

export default function SuggestoesPage() {
  return (
    <AdminShell pageTitle="Sugestões" activeItem="sugestoes">
      <SuggestoesPageClient />
    </AdminShell>
  );
}
