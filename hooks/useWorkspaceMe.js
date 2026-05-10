'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const CACHE_TTL_MS = 30 * 1000;
let workspaceMeCache = {
  value: null,
  fetchedAt: 0,
  promise: null,
};

function isCacheFresh() {
  return workspaceMeCache.value && Date.now() - workspaceMeCache.fetchedAt < CACHE_TTL_MS;
}

async function fetchWorkspaceMe({ force = false } = {}) {
  if (!force && isCacheFresh()) {
    return workspaceMeCache.value;
  }

  if (!force && workspaceMeCache.promise) {
    return workspaceMeCache.promise;
  }

  workspaceMeCache.promise = fetch('/api/workspace/me', {
    method: 'GET',
    cache: 'no-store',
    credentials: 'include',
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        const error = new Error(payload?.error || 'Falha ao carregar permissões do workspace.');
        error.status = response.status;
        throw error;
      }

      workspaceMeCache.value = payload;
      workspaceMeCache.fetchedAt = Date.now();
      return payload;
    })
    .finally(() => {
      workspaceMeCache.promise = null;
    });

  return workspaceMeCache.promise;
}

export function clearWorkspaceMeCache() {
  workspaceMeCache = {
    value: null,
    fetchedAt: 0,
    promise: null,
  };
}

export default function useWorkspaceMe({ enabled = true } = {}) {
  const mountedRef = useRef(false);
  const [data, setData] = useState(() => (isCacheFresh() ? workspaceMeCache.value : null));
  const [loading, setLoading] = useState(enabled && !isCacheFresh());
  const [error, setError] = useState(null);

  const reload = useCallback(async ({ force = true } = {}) => {
    if (!enabled) return null;

    setLoading(true);
    setError(null);

    try {
      const payload = await fetchWorkspaceMe({ force });
      if (mountedRef.current) {
        setData(payload);
      }
      return payload;
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
        setData(null);
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      setLoading(false);
      return () => {
        mountedRef.current = false;
      };
    }

    if (isCacheFresh()) {
      setData(workspaceMeCache.value);
      setLoading(false);
    } else {
      reload({ force: false });
    }

    return () => {
      mountedRef.current = false;
    };
  }, [enabled, reload]);

  return {
    data,
    workspaceMe: data,
    loading,
    error,
    reload,
    clearCache: clearWorkspaceMeCache,
    role: data?.role || null,
    permissions: data?.permissions || null,
    modules: data?.permissions?.modules || [],
    canAccessModule(moduleKey) {
      if (!moduleKey) return true;
      const modules = data?.permissions?.modules || [];
      return Array.isArray(modules) && modules.includes(moduleKey);
    },
  };
}
