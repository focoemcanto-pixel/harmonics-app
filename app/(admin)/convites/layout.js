'use client';

import WorkspaceModuleGuard from '@/components/workspace/WorkspaceModuleGuard';

export default function ConvitesLayout({ children }) {
  return (
    <WorkspaceModuleGuard moduleKey="eventos">
      {children}
    </WorkspaceModuleGuard>
  );
}
