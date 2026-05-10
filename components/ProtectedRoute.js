'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import useWorkspaceMe from '@/hooks/useWorkspaceMe';

function inferModuleFromPath(pathname = '') {
  if (pathname.startsWith('/pagamentos')) return 'pagamentos';
  if (pathname.startsWith('/automacoes')) return 'automacoes';
  if (pathname.startsWith('/configuracoes/equipe') || pathname.startsWith('/admin/usuarios')) return 'usuarios';
  if (pathname.startsWith('/contratos') || pathname.startsWith('/pre-contratos')) return 'contratos';
  if (pathname.startsWith('/escalas')) return 'escalas';
  if (pathname.startsWith('/eventos')) return 'eventos';
  if (pathname.startsWith('/contatos')) return 'contatos';
  if (pathname.startsWith('/convites')) return 'convites';
  if (pathname.startsWith('/repertorios')) return 'repertorios';
  if (pathname.startsWith('/sugestoes')) return 'sugestoes';
  if (pathname.startsWith('/avaliacoes')) return 'avaliacoes';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  return null;
}

function LoadingAccess() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Verificando acesso...</p>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children, requiredRole = null }) {
  const { user, profile, loading, initialized, authError, profileResolved } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const redirectingRef = useRef(false);

  const moduleKey = useMemo(() => inferModuleFromPath(pathname || ''), [pathname]);
  const {
    workspaceMe,
    loading: workspaceLoading,
    error: workspaceError,
    role: workspaceRoleRaw,
    modules,
  } = useWorkspaceMe({ enabled: Boolean(initialized && !loading && user) });

  const workspaceRole = String(workspaceRoleRaw || '').toLowerCase();
  const isWorkspaceAdmin = ['owner', 'admin'].includes(workspaceRole);

  const workspaceAllowsModule = useMemo(() => {
    if (!moduleKey) return true;
    return Array.isArray(modules) && modules.includes(moduleKey);
  }, [moduleKey, modules]);

  useEffect(() => {
    if (!initialized || loading || redirectingRef.current) return;

    const currentRole = profile?.role || null;

    if (!user) {
      console.info('[ProtectedRoute] bloqueado: sem sessão', { pathname });
      redirectingRef.current = true;
      router.replace('/login');
      router.refresh();
      setTimeout(() => {
        window.location.assign('/login');
      }, 300);
      return;
    }

    if (workspaceError?.status === 401) {
      redirectingRef.current = true;
      router.replace('/login');
      return;
    }

    if (requiredRole && !profileResolved) {
      console.info('[ProtectedRoute] aguardando perfil para validação de role', {
        pathname,
        requiredRole,
      });
      return;
    }

    if (workspaceLoading) {
      console.info('[ProtectedRoute] aguardando permissões do workspace', {
        pathname,
        requiredRole,
        moduleKey,
      });
      return;
    }

    const globalRoleAllows = requiredRole ? currentRole === requiredRole : true;
    const workspaceAllows = requiredRole === 'admin'
      ? (isWorkspaceAdmin || workspaceAllowsModule)
      : workspaceAllowsModule;

    if (requiredRole && !globalRoleAllows && !workspaceAllows) {
      console.info('[ProtectedRoute] bloqueado: permissão inválida', {
        pathname,
        requiredRole,
        currentRole,
        workspaceRole,
        moduleKey,
        workspaceAllowsModule,
      });
      redirectingRef.current = true;
      router.replace('/acesso-negado');
      return;
    }

    if (!workspaceAllowsModule) {
      console.info('[ProtectedRoute] bloqueado: módulo fora das permissões', {
        pathname,
        workspaceRole,
        moduleKey,
      });
      redirectingRef.current = true;
      router.replace('/acesso-negado');
      return;
    }

    console.info('[ProtectedRoute] acesso liberado', {
      pathname,
      userId: user?.id || null,
      role: currentRole,
      workspaceRole,
      requiredRole,
      moduleKey,
    });
  }, [
    initialized,
    loading,
    user,
    profile,
    requiredRole,
    router,
    pathname,
    profileResolved,
    workspaceLoading,
    workspaceError,
    workspaceRole,
    isWorkspaceAdmin,
    workspaceAllowsModule,
    moduleKey,
  ]);

  useEffect(() => {
    if (!loading && !workspaceLoading) {
      redirectingRef.current = false;
    }
  }, [loading, workspaceLoading]);

  if (!initialized || loading || workspaceLoading || (requiredRole && user && !profileResolved)) {
    return <LoadingAccess />;
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          <h2 className="text-base font-bold">Falha ao validar autenticação</h2>
          <p className="mt-2 text-sm">
            Não foi possível validar sua sessão no momento. Atualize a página ou faça login novamente.
          </p>
        </div>
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          <h2 className="text-base font-bold">Falha ao validar permissões</h2>
          <p className="mt-2 text-sm">{workspaceError?.message || 'Atualize a página ou faça login novamente.'}</p>
        </div>
      </div>
    );
  }

  const currentRole = profile?.role || null;
  const globalRoleAllows = requiredRole ? currentRole === requiredRole : true;
  const workspaceAllows = requiredRole === 'admin'
    ? (isWorkspaceAdmin || workspaceAllowsModule)
    : workspaceAllowsModule;

  if (!user || !workspaceMe?.ok || (requiredRole && !globalRoleAllows && !workspaceAllows) || !workspaceAllowsModule) {
    return null;
  }

  return <>{children}</>;
}
