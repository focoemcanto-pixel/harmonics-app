'use client';

import { AdminContentSkeleton } from '@/components/layout/AppShellSkeleton';
import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useWorkspaceMe from '@/hooks/useWorkspaceMe';

function AccessDenied({ moduleKey }) {
  return (
    <div className="min-h-[60vh] px-0 py-10">
      <div className="mx-auto max-w-xl rounded-[24px] border border-[var(--hx-border,#e4e7ec)] bg-white p-6 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">🚫</div>
        <h1 className="mt-4 text-2xl font-black tracking-[-0.04em] text-slate-900">Acesso não permitido</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          Seu cargo atual não possui permissão para acessar este módulo{moduleKey ? ` (${moduleKey})` : ''}.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign('/dashboard')}
          className="mt-5 rounded-full bg-[#0c0d12] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black"
        >
          Voltar para o dashboard
        </button>
      </div>
    </div>
  );
}

function LoadingAccess() {
  return <AdminContentSkeleton label="Verificando permissões" />;
}

export default function WorkspaceModuleGuard({
  children,
  moduleKey,
  requireAdmin = false,
  redirectOnDenied = false,
}) {
  const router = useRouter();

  const {
    workspaceMe,
    loading,
    error,
    role,
    modules,
  } = useWorkspaceMe();

  useEffect(() => {
    if (!loading && error && /401|sess[aã]o|login/i.test(String(error?.message || error || ''))) {
      router.replace('/login');
    }
  }, [error, loading, router]);

  const canAccess = useMemo(() => {
    if (!workspaceMe?.ok) return false;

    const normalizedRole = String(role || '').toLowerCase();

    if (requireAdmin && !['owner', 'admin'].includes(normalizedRole)) {
      return false;
    }

    if (!moduleKey) return true;

    return Array.isArray(modules) && modules.includes(moduleKey);
  }, [moduleKey, modules, requireAdmin, role, workspaceMe]);

  useEffect(() => {
    if (!loading && workspaceMe?.ok && !canAccess && redirectOnDenied) {
      router.replace('/dashboard');
    }
  }, [canAccess, loading, redirectOnDenied, router, workspaceMe]);

  if (loading) return <LoadingAccess />;

  if (error) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          <h2 className="text-base font-bold">Falha ao validar permissões</h2>
          <p className="mt-2 text-sm">{error?.message || String(error)}</p>
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
