'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ProtectedRoute({ children, requiredRole = null }) {
  const { user, profile, loading, initialized, authError } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (!initialized || loading || redirectingRef.current) {
      return;
    }

    const currentRole = profile?.role || null;

    if (!user) {
      console.info('[ProtectedRoute] bloqueado: sem sessão', { pathname });
      redirectingRef.current = true;
      router.replace('/login');
      return;
    }

    if (requiredRole && currentRole !== requiredRole) {
      console.info('[ProtectedRoute] bloqueado: role inválida', {
        pathname,
        requiredRole,
        currentRole,
      });
      redirectingRef.current = true;
      router.replace('/acesso-negado');
    }

    console.info('[ProtectedRoute] acesso liberado', {
      pathname,
      userId: user?.id || null,
      role: currentRole,
      requiredRole,
    });
  }, [initialized, loading, user, profile, requiredRole, router, pathname]);

  useEffect(() => {
    if (!loading) {
      redirectingRef.current = false;
    }
  }, [loading]);

  if (!initialized || loading) {
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

  if (!user || (requiredRole && profile?.role !== requiredRole)) {
    return null;
  }

  return <>{children}</>;
}
