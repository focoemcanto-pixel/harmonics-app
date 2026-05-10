'use client';

import WorkspaceModuleGuard from '@/components/workspace/WorkspaceModuleGuard';

export default function SugestoesLayout({ children }) {
  return (
    <WorkspaceModuleGuard moduleKey="sugestoes">
      {children}
    </WorkspaceModuleGuard>
  );
}
