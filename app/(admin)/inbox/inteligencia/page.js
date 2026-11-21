import AdminShell from '@/components/layout/AdminShell';
import ProtectedRoute from '@/components/ProtectedRoute';
import CommercialIntelligenceClient from '@/components/inbox/CommercialIntelligenceClient';

import { supervisionEnabled } from '@/lib/ai/commercial/simulation-supervision.mjs';

export const dynamic = 'force-dynamic';

export default function CommercialIntelligencePage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminShell pageTitle="Inteligência Comercial" activeItem="inbox">
        <CommercialIntelligenceClient simulationOnly={supervisionEnabled()} />
      </AdminShell>
    </ProtectedRoute>
  );
}
