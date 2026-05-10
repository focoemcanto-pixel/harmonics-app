import AdminShell from '@/components/layout/AdminShell';
import AutomacoesPageClient from '@/components/automacoes/AutomacoesPageClient';
import WorkspaceModuleGuard from '@/components/workspace/WorkspaceModuleGuard';

export default function AutomacoesPage() {
  return (
    <WorkspaceModuleGuard moduleKey="automacoes" requireAdmin>
      <AdminShell pageTitle="Central de Automação" activeItem="automacoes">
        <AutomacoesPageClient />
      </AdminShell>
    </WorkspaceModuleGuard>
  );
}
