'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import AdminMobileTopbar from './AdminMobileTopbar';
import AdminBottomNav from './AdminBottomNav';
import { MobileMoreSheet } from '../layout/AdminShell';

export default function AdminShell({
  pageTitle,
  children,
  mobileActions,
  activeItem = 'eventos',
}) {
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const mobileActiveItem = useMemo(() => {
    const allowed = ['dashboard', 'eventos', 'contatos', 'contratos', 'mais'];
    if (allowed.includes(activeItem)) return activeItem;
    return 'mais';
  }, [activeItem]);

  function handleMoreNavigate(href) {
    setMoreOpen(false);
    router.push(href);
  }

  function handleOpenMore() {
    setMoreOpen(true);
  }

  return (
    <div className="min-h-screen bg-[#f4f6fa] text-[#111827]">
      <div className="hidden md:flex">
        <AdminSidebar activeItem={activeItem} />
        <main className="min-h-screen flex-1">
          <div className="mx-auto w-full max-w-[1440px] px-6 py-6">
            {children}
          </div>
        </main>
      </div>

      <div className="md:hidden">
        <AdminMobileTopbar title={pageTitle} actions={mobileActions} />
        <main className="px-4 pb-28 pt-4">{children}</main>

        <AdminBottomNav
          activeItem={mobileActiveItem}
          onOpenMore={handleOpenMore}
        />

        <MobileMoreSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          onNavigate={handleMoreNavigate}
        />
      </div>
    </div>
  );
}
