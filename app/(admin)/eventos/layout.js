'use client';

import WorkspaceModuleGuard from '@/components/workspace/WorkspaceModuleGuard';
import MobileScaleWorkspaceGuard from '@/components/escalas/MobileScaleWorkspaceGuard';

export default function EventosLayout({ children }) {
  return (
    <WorkspaceModuleGuard moduleKey="eventos">
      <MobileScaleWorkspaceGuard />
      {children}
    </WorkspaceModuleGuard>
  );
}
