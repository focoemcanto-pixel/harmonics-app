import AdminShell from '@/components/layout/AdminShell';
import TemplatesPageClient from '@/components/automacoes/TemplatesPageClient';

export default function TemplatesPage() {
  return (
    <AdminShell pageTitle="Templates de Mensagens" activeItem="automacoes">
      <TemplatesPageClient />
    </AdminShell>
  );
}
