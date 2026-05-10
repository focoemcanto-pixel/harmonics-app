'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

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

export default function ProtectedRoute({ children, requiredRole = null }) {
  const { user, profile, loading, initialized, authError, profileResolved } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const redirectingRef = useRef(false);
  const [workspaceMe, setWorkspaceMe] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceChecked, setWorkspaceChecked] = useState(false);

  const moduleKey = useMemo(() => inferModuleFromPath(pathname || ''), [pathname]);

  useEffect(() => {
    if (!initialized || loading || !user) return;

    let alive = true;

    async function loadWorkspaceAccess() {
      setWorkspaceLoading(true);
      try {
        const response = await fetch('/api/workspace/me', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        });
        const payload = await response.json().catch(() => null);

        if (!alive) return;

        if (response.ok && payload?.ok) {
          setWorkspaceMe(payload);
        } else {
          setWorkspaceMe(null);
        }
      } catch (error) {
        console.warn('[ProtectedRoute] falha ao carregar workspace/me', error?.message || error);
        if (alive) setWorkspaceMe(null);
      } finally {
        if (alive) {
          setWorkspaceLoading(false);
          setWorkspaceChecked(true);
        }
      }
    }

    loadWorkspaceAccess();

    return () => {
      alive = false;
    };
  }, [initialized, loading, user, pathname]);

  const workspaceAllowsModule = useMemo(() => {
    if (!moduleKey) return true;
    const modules = workspaceMe?.permissions?.modules;
    return Array.isArray(modules) && modules.includes(moduleKey);
  }, [moduleKey, workspaceMe]);

  const workspaceRole = String(workspaceMe?.role || '').toLowerCase();
  const isWorkspaceAdmin = ['owner', 'admin'].includes(workspaceRole);

  useEffect(() => {
    if (!initialized || loading || redirectingRef.current) {
      return;
    }

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

    if (requiredRole && !profileResolved) {
      console.info('[ProtectedRoute] aguardando perfil para validação de role', {
        pathname,
        requiredRole,
      });
      return;
    }

    if (requiredRole && !workspaceChecked) {
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
    workspaceChecked,
    workspaceRole,
    isWorkspaceAdmin,
    workspaceAllowsModule,
    moduleKey,
  ]);

  useEffect(() => {
    if (!loading) {
      redirectingRef.current = false;
    }
  }, [loading]);

  if (!initialized || loading || workspaceLoading || (requiredRole && user && (!profileResolved || !workspaceChecked))) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Verificando acesso...</p>
        </div>
      </div>
    );
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

  const currentRole = profile?.role || null;
  const globalRoleAllows = requiredRole ? currentRole === requiredRole : true;
  const workspaceAllows = requiredRole === 'admin'
    ? (isWorkspaceAdmin || workspaceAllowsModule)
    : workspaceAllowsModule;

  if (!user || (requiredRole && !globalRoleAllows && !workspaceAllows) || !workspaceAllowsModule) {
    return null;
  }

  return <>{children}</>;
}
