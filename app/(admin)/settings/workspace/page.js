import AdminShell from '@/components/layout/AdminShell';
import WorkspaceSettingsClient from '@/components/workspace/WorkspaceSettingsClient';

export const dynamic = 'force-dynamic';

export default function WorkspaceSettingsPage() {
  return (
    <AdminShell pageTitle="Workspace" activeItem="workspace" mobileSubtitle="Identidade, tema e gerenciamento">
      <WorkspaceSettingsClient />
    </AdminShell>
  );
}
