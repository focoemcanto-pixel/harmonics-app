'use client';

import WorkspaceModuleGuard from '@/components/workspace/WorkspaceModuleGuard';

export default function PreContratosLayout({ children }) {
  return (
    <WorkspaceModuleGuard moduleKey="contratos">
      {children}
    </WorkspaceModuleGuard>
  );
}
