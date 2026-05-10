'use client';

import WorkspaceModuleGuard from '@/components/workspace/WorkspaceModuleGuard';

export default function EscalasLayout({ children }) {
  return (
    <WorkspaceModuleGuard moduleKey="eventos">
      {children}
    </WorkspaceModuleGuard>
  );
}
