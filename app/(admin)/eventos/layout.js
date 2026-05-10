'use client';

import WorkspaceModuleGuard from '@/components/workspace/WorkspaceModuleGuard';

export default function EventosLayout({ children }) {
  return (
    <WorkspaceModuleGuard moduleKey="eventos">
      {children}
    </WorkspaceModuleGuard>
  );
}
