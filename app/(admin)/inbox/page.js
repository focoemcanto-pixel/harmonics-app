'use client';

import AdminShell from '@/components/layout/AdminShell';
import InboxClient from '@/components/inbox/InboxClient';
import useWorkspaceMe from '@/hooks/useWorkspaceMe';

const ADMIN_ROLES = new Set(['owner', 'admin', 'administrador']);

export default function InboxPage() {
  const { role } = useWorkspaceMe();
  return (
    <AdminShell pageTitle="Inbox WhatsApp" activeItem="inbox" mobileSubtitle="Atendimento IA + equipe">
      <InboxClient canAdmin={ADMIN_ROLES.has(String(role || '').toLowerCase())} />
    </AdminShell>
  );
}
