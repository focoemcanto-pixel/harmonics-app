'use client';

import AdminPill from '../admin/AdminPill';
import { getRoleIcon, formatDateBR } from '../../lib/escalas/escalas-format';
import { getStatusLabel, getStatusColor } from '../../lib/escalas/escalas-ui';

export default function EscalaCard({ escala, onEdit, onDelete, onChangeStatus }) {
  // Priorizar snapshots
  const musicianName = escala.musician_name || escala.contacts?.name || 'Músico não identificado';
  const musicianEmail = escala.musician_email || escala.contacts?.email || null;
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

      {/* Warning se músico sem email */}
      {!musicianEmail && (
        <div className="mt-3 rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-700">
          <strong>⚠️ Atenção:</strong> Músico sem email cadastrado — não poderá receber convites de confirmação.
        </div>
      )}

      {(onEdit || onDelete || onChangeStatus) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(escala)}
              className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-2 text-[13px] font-black text-[#0f172a] transition hover:bg-[#f8fafc]"
            >
              Editar
            </button>
          )}
          {onChangeStatus && status !== 'confirmed' && (
            <button
              type="button"
              onClick={() => onChangeStatus(escala.id, 'confirmed')}
              className="rounded-[16px] bg-emerald-600 px-4 py-2 text-[13px] font-black text-white transition hover:bg-emerald-700"
            >
              Confirmar
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(escala.id)}
              className="rounded-[16px] bg-red-600 px-4 py-2 text-[13px] font-black text-white transition hover:bg-red-700"
            >
              Excluir
            </button>
          )}
        </div>
      )}
    </div>
  );
}
