'use client';

import { useEffect, useMemo, useState } from 'react';

const WORKSPACE_CACHE_KEY = 'harmonics:last-current-workspace';

function safeReadWorkspaceCache() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(WORKSPACE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.workspaceId ? parsed : null;
  } catch {
    return null;
  }
}

function safeWriteWorkspaceCache(workspace) {
  if (typeof window === 'undefined' || !workspace?.workspaceId) return;

  try {
    window.localStorage.setItem(WORKSPACE_CACHE_KEY, JSON.stringify(workspace));
  } catch {
    // storage pode estar indisponível em alguns contextos; não deve quebrar a UI.
  }
}

function normalizeWorkspacePayload(payload) {
  if (!payload?.ok) return null;

  const workspace = payload.workspace || null;
  const settings = payload.settings || null;
  const displayName =
    settings?.public_name ||
    settings?.company_name ||
    workspace?.name ||
    workspace?.slug ||
    'Workspace';

  const primaryColor =
    settings?.primary_color ||
    settings?.settings?.primary_color ||
    '#7c3aed';

  return {
    workspaceId: payload.workspaceId || workspace?.id || null,
    workspace,
    settings,
    membership: payload.membership || null,
    role: payload.role || null,
    source: payload.source || null,
    displayName,
    initials: String(displayName || 'W')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'W',
    primaryColor,
    logoUrl: settings?.logo_url || null,
    supportWhatsapp: settings?.support_whatsapp || settings?.admin_whatsapp || null,
  };
}

export default function useCurrentWorkspace() {
  const [data, setData] = useState(() => safeReadWorkspaceCache());
  const [loading, setLoading] = useState(() => !safeReadWorkspaceCache());
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      try {
        setLoading((current) => current || !data);
        setError(null);

        const response = await fetch('/api/workspace/current', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || 'Não foi possível carregar o workspace atual.');
        }

        const normalized = normalizeWorkspacePayload(payload);

        if (active) {
          setData(normalized);
          safeWriteWorkspaceCache(normalized);
        }
      } catch (err) {
        if (active) {
          setError(err);
          // Mantém o último workspace em cache para evitar flash da marca padrão durante navegação.
          setData((current) => current || safeReadWorkspaceCache());
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadWorkspace();

    return () => {
      active = false;
    };
    // intentionally only once per mount; cache prevents branding flash on route transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useMemo(
    () => ({
      workspace: data,
      loading,
      error,
    }),
    [data, loading, error]
  );
}
