import AdminShell from '@/components/layout/AdminShell';
import IaPageClient from '@/components/automacoes/IaPageClient';

export default function IaPage() {
  return (
    <AdminShell pageTitle="Configuração de IA" activeItem="automacoes">
      <IaPageClient />
    </AdminShell>
  );
}
