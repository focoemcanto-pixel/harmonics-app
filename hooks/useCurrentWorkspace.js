'use client';

import { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

export const WORKSPACE_CACHE_KEY = 'harmonics:last-current-workspace';

const WORKSPACE_STORAGE_KEYS_TO_CLEAR = [
  WORKSPACE_CACHE_KEY,
  'harmonics:precontract-guide:v9',
  'harmonics_pending_signup_bootstrap',
];

export function clearWorkspaceScopedStorage() {
  if (typeof window === 'undefined') return;
  invalidateCurrentWorkspaceCache();

  try {
    for (const key of WORKSPACE_STORAGE_KEYS_TO_CLEAR) {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // storage pode estar indisponível em alguns contextos; não deve quebrar a UI.
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

// Cache em memória compartilhado entre os componentes da mesma aba (menu, topo, páginas):
// uma única requisição em voo e revalidação silenciosa. Só guarda o que a API confirmou nesta
// sessão de página e é descartado ao trocar de usuário ou quando o workspace é alterado.
const CURRENT_WORKSPACE_FRESH_MS = 60 * 1000;
export const CURRENT_WORKSPACE_INVALIDATED_EVENT = 'harmonics:current-workspace-invalidated';

let currentWorkspaceCache = { userId: null, value: null, fetchedAt: 0, promise: null };

function resetCurrentWorkspaceCache() {
  currentWorkspaceCache = { userId: null, value: null, fetchedAt: 0, promise: null };
}

export function invalidateCurrentWorkspaceCache({ broadcast = true } = {}) {
  resetCurrentWorkspaceCache();
  if (broadcast && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CURRENT_WORKSPACE_INVALIDATED_EVENT));
  }
}

function fetchCurrentWorkspace(userId) {
  if (currentWorkspaceCache.promise && currentWorkspaceCache.userId === userId) {
    return currentWorkspaceCache.promise;
  }

  const promise = fetch('/api/workspace/current', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Não foi possível carregar o workspace atual.');
      }
      const normalized = normalizeWorkspacePayload(payload);
      if (currentWorkspaceCache.promise === promise) {
        currentWorkspaceCache = { userId, value: normalized, fetchedAt: Date.now(), promise: null };
      }
      return normalized;
    })
    .catch((error) => {
      if (currentWorkspaceCache.promise === promise) {
        currentWorkspaceCache = { userId, value: null, fetchedAt: 0, promise: null };
      }
      throw error;
    });

  currentWorkspaceCache = { ...currentWorkspaceCache, userId, promise };
  return promise;
}

export default function useCurrentWorkspace() {
  const authUserId = useContext(AuthContext)?.user?.id || null;
  if (currentWorkspaceCache.userId && authUserId && currentWorkspaceCache.userId !== authUserId) {
    resetCurrentWorkspaceCache();
  }
  const cached = currentWorkspaceCache.value && currentWorkspaceCache.userId === authUserId ? currentWorkspaceCache.value : null;

  const [data, setData] = useState(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    function handleInvalidated() {
      setVersion((value) => value + 1);
    }
    window.addEventListener(CURRENT_WORKSPACE_INVALIDATED_EVENT, handleInvalidated);
    return () => window.removeEventListener(CURRENT_WORKSPACE_INVALIDATED_EVENT, handleInvalidated);
  }, []);

  useEffect(() => {
    let active = true;
    const hasValue = currentWorkspaceCache.value && currentWorkspaceCache.userId === authUserId;
    const isFresh = hasValue && Date.now() - currentWorkspaceCache.fetchedAt < CURRENT_WORKSPACE_FRESH_MS;
    // Valor recente do cache já veio no estado inicial: nada a buscar.
    if (isFresh && version === 0) return () => { active = false; };

    fetchCurrentWorkspace(authUserId)
      .then((normalized) => {
        if (!active) return;
        setError(null);
        setData(normalized);
        safeWriteWorkspaceCache(normalized);
      })
      .catch((err) => {
        if (!active) return;
        setError(err);
        // Não renderiza workspace antigo: em troca/criação/exclusão multi-tenant,
        // o nome só pode aparecer depois de confirmado por /api/workspace/current.
        setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authUserId, version]);

  return useMemo(
    () => ({
      workspace: data,
      loading,
      error,
    }),
    [data, loading, error]
  );
}
