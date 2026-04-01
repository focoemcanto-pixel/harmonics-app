import AdminShell from '@/components/layout/AdminShell';
import CanaisPageClient from '@/components/automacoes/CanaisPageClient';

export default function CanaisPage() {
  return (
    <AdminShell pageTitle="Canais de Envio" activeItem="automacoes">
      <CanaisPageClient />
    </AdminShell>
  );
}
