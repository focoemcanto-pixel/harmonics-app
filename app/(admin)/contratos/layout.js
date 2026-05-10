'use client';

import WorkspaceModuleGuard from '@/components/workspace/WorkspaceModuleGuard';

export default function ContratosLayout({ children }) {
  return (
    <WorkspaceModuleGuard moduleKey="contratos">
      {children}
    </WorkspaceModuleGuard>
  );
}
