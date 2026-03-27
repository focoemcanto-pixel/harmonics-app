'use client';

import AdminSidebar from './AdminSidebar';
import AdminMobileTopbar from './AdminMobileTopbar';
import AdminBottomNav from './AdminBottomNav';

export default function AdminShell({
  pageTitle,
  children,
  mobileActions,
  activeItem = 'eventos',
}) {
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
        <AdminBottomNav activeItem={activeItem} />
      </div>
    </div>
  );
}