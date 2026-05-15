'use client';

import { useState, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import AdminMobileTopbar from './AdminMobileTopbar';
import AdminBottomNav from './AdminBottomNav';
import WorkspaceThemeProvider from './WorkspaceThemeProvider';
import DeferredOnboardingMount from '@/components/onboarding/DeferredOnboardingMount';
import { MobileMoreSheet } from '../layout/AdminShell';

export default function AdminShell({
  pageTitle,
  children,
  mobileActions,
  activeItem = 'eventos',
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);

  const forceTemplateGuide = pathname === '/contratos/templates' && (
    searchParams?.get('guide') === 'template' || searchParams?.get('onboarding') === 'template'
  );

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
    <WorkspaceThemeProvider>
      <div className="min-h-screen bg-[#f4f6fa] text-[#111827]">
        <div className="hidden md:flex">
          <AdminSidebar activeItem={activeItem} />
          <main className="min-h-screen flex-1">
            <div className="mx-auto w-full max-w-[1440px] px-6 py-6">
              {forceTemplateGuide ? <DeferredOnboardingMount variant="route" showTour /> : null}
              {children}
            </div>
          </main>
        </div>

        <div className="md:hidden">
          <AdminMobileTopbar title={pageTitle} actions={mobileActions} />
          <main className="px-4 pb-28 pt-4">
            {forceTemplateGuide ? <DeferredOnboardingMount variant="route" showTour /> : null}
            {children}
          </main>

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
    </WorkspaceThemeProvider>
  );
}
