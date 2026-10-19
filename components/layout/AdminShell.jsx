'use client';

import { useLayoutEffect } from 'react';
import AdminFrame from '@/components/admin/shell/AdminFrame';
import MobileMoreSheet from '@/components/admin/shell/MobileMoreSheet';
import { useAdminShell } from '@/components/admin/shell/AdminShellContext';

/**
 * API das páginas do admin. O frame (menu, topo, navegação mobile) vive no layout de app/(admin)
 * e permanece montado entre as telas; aqui a página só informa título, subtítulo e ações do topo
 * mobile. Fora do layout do admin (uso legado), monta o frame completo como antes.
 */
export default function AdminShell({ pageTitle, children, mobileActions, activeItem = 'eventos', mobileSubtitle = '' }) {
  const shell = useAdminShell();
  const setMeta = shell?.setMeta;

  useLayoutEffect(() => {
    if (!setMeta) return undefined;
    setMeta({ pageTitle, mobileSubtitle, mobileActions, activeItem });
    return undefined;
  }, [activeItem, mobileActions, mobileSubtitle, pageTitle, setMeta]);

  useLayoutEffect(() => {
    if (!setMeta) return undefined;
    return () => setMeta({});
  }, [setMeta]);

  if (!shell) {
    return <AdminFrame>{children}</AdminFrame>;
  }

  return children;
}

export { MobileMoreSheet };
