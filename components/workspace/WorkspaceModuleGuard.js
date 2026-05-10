'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

function AccessDenied({ moduleKey }) {
  return (
    <div className="min-h-[60vh] bg-[#f4f6fa] px-4 py-10">
      <div className="mx-auto max-w-xl rounded-[28px] border border-red-100 bg-white p-6 text-center shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">🚫</div>
        <h1 className="mt-4 text-2xl font-black tracking-[-0.04em] text-slate-900">Acesso não permitido</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          Seu cargo atual não possui permissão para acessar este módulo{moduleKey ? ` (${moduleKey})` : ''}.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign('/dashboard')}
          className="mt-5 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700"
        >
          Voltar para o dashboard
        </button>
      </div>
    </div>
  );
}

function LoadingAccess() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4" />
        <p className="text-slate-600 font-semibold">Verificando permissões...</p>
      </div>
    </div>
  );
}

export default function WorkspaceModuleGuard({
  children,
  moduleKey,
  requireAdmin = false,
  redirectOnDenied = false,
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [workspaceMe, setWorkspaceMe] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function loadAccess() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch('/api/workspace/me', { method: 'GET', cache: 'no-store' });
        const payload = await response.json().catch(() => null);

        if (!alive) return;

        if (response.status === 401) {
          router.replace('/login');
          return;
        }

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || 'Falha ao validar permissões.');
        }

        setWorkspaceMe(payload);
      } catch (err) {
        setError(err?.message || 'Falha ao validar permissões.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadAccess();

    return () => {
      alive = false;
    };
  }, [router]);

  const canAccess = useMemo(() => {
    if (!workspaceMe?.ok) return false;

    const role = String(workspaceMe?.role || '').toLowerCase();
    const modules = workspaceMe?.permissions?.modules || [];

    if (requireAdmin && !['owner', 'admin'].includes(role)) return false;
    if (!moduleKey) return true;

    return Array.isArray(modules) && modules.includes(moduleKey);
  }, [moduleKey, requireAdmin, workspaceMe]);

  useEffect(() => {
    if (!loading && workspaceMe?.ok && !canAccess && redirectOnDenied) {
      router.replace('/dashboard');
    }
  }, [canAccess, loading, redirectOnDenied, router, workspaceMe]);

  if (loading) return <LoadingAccess />;

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          <h2 className="text-base font-bold">Falha ao validar permissões</h2>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    if (redirectOnDenied) return null;
    return <AccessDenied moduleKey={moduleKey} />;
  }

  return <>{children}</>;
}
