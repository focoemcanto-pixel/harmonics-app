'use client';

import { useEffect } from 'react';
import useCurrentWorkspace from '@/hooks/useCurrentWorkspace';

function isValidHexColor(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || '').trim());
}

function normalizeColor(value, fallback = '#7c3aed') {
  const color = String(value || '').trim();
  return isValidHexColor(color) ? color : fallback;
}

export default function WorkspaceThemeProvider({ children }) {
  const { workspace } = useCurrentWorkspace();
  const primaryColor = normalizeColor(workspace?.primaryColor);
  const workspaceName = workspace?.displayName || 'Workspace';

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.style.setProperty('--workspace-primary', primaryColor);
    root.style.setProperty('--workspace-primary-soft', `${primaryColor}18`);
    root.style.setProperty('--workspace-primary-border', `${primaryColor}44`);
    root.style.setProperty('--workspace-name', JSON.stringify(workspaceName));
  }, [primaryColor, workspaceName]);

  return children;
}
