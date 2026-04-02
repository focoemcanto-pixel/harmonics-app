import AdminShell from '@/components/layout/AdminShell';
import RegrasPageClient from '@/components/automacoes/RegrasPageClient';

export const metadata = {
  title: 'Regras de Automação | Harmonics',
};

export default function RegrasPage() {
  return (
    <AdminShell pageTitle="Regras de Automação" activeItem="automacoes">
      <RegrasPageClient />
    </AdminShell>
  );
}
