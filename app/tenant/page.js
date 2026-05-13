import AdminShell from '@/components/layout/AdminShell';
import WorkspaceSettingsClient from '@/components/workspace/WorkspaceSettingsClient';

export default function TenantPage() {
  return (
    <AdminShell pageTitle="Tenant" activeItem="mais">
      <WorkspaceSettingsClient />
    </AdminShell>
  );
}
