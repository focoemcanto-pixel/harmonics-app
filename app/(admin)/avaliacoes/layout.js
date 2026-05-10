'use client';

import WorkspaceModuleGuard from '@/components/workspace/WorkspaceModuleGuard';

export default function AvaliacoesLayout({ children }) {
  return (
    <WorkspaceModuleGuard moduleKey="avaliacoes">
      {children}
    </WorkspaceModuleGuard>
  );
}
