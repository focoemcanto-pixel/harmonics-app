'use client';

import AdminPill from '../admin/AdminPill';
import { getRoleIcon, formatDateBR } from '../../lib/escalas/escalas-format';
import { getStatusLabel, getStatusColor } from '../../lib/escalas/escalas-ui';

export default function EscalaCard({ escala }) {
  const musicianName = escala.contacts?.name || 'Músico não identificado';
  const clientName = escala.events?.client_name || 'Evento não identificado';
  const eventDate = escala.events?.event_date || '';
  const role = escala.role || 'Sem função';
  const status = escala.status || 'pending';

  const statusLabel = getStatusLabel(status);
  const statusTone = getStatusColor(status);
  const roleIcon = getRoleIcon(role);

  return (
    <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.04)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="text-[20px] font-black text-[#0f172a]">
            {musicianName}
          </div>
          <div className="mt-1 text-[14px] font-semibold text-[#64748b]">
            {clientName}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <AdminPill tone={statusTone}>{statusLabel}</AdminPill>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[14px] text-slate-700">
          <strong>Função:</strong> {roleIcon} {role} &nbsp;•&nbsp;
          <strong>Data:</strong> {formatDateBR(eventDate) || '-'}
        </p>

        {escala.notes ? (
          <p className="mt-2 text-[13px] text-slate-500">
            <strong>Obs:</strong> {escala.notes}
          </p>
        ) : null}
      </div>
    </div>
  );
}
