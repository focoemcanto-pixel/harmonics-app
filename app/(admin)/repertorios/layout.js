'use client';

import WorkspaceModuleGuard from '@/components/workspace/WorkspaceModuleGuard';

export default function RepertoriosLayout({ children }) {
  return (
    <WorkspaceModuleGuard moduleKey="repertorios">
      {children}
    </WorkspaceModuleGuard>
  );
}
