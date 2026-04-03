import { Suspense } from 'react';
import AdminShell from '@/components/layout/AdminShell';
import LogsPageClient from '@/components/automacoes/LogsPageClient';

export default function LogsPage() {
  return (
    <AdminShell pageTitle="Logs de Automação" activeItem="automacoes">
      <Suspense fallback={<div className="flex items-center justify-center min-h-[200px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>}>
        <LogsPageClient />
      </Suspense>
    </AdminShell>
  );
}
