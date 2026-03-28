'use client';

import AdminPill from '../admin/AdminPill';
import { getRoleIcon, formatDateBR } from '../../lib/escalas/escalas-format';
import { getStatusLabel, getStatusColor } from '../../lib/escalas/escalas-ui';
import EscalaInviteButton from './EscalaInviteButton';

export default function EscalaCard({ escala, onEdit, onDelete, onChangeStatus, onEnviarConvite }) {
  const musicianName = escala.musician_name || escala.contacts?.name || 'Músico não identificado';
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

      {/* Ações */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onEdit(escala)}
          className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-2 text-[13px] font-black text-[#0f172a] transition hover:bg-slate-50"
        >
          Editar
        </button>

        {/* Botão de convite */}
        <EscalaInviteButton escala={escala} onEnviarConvite={onEnviarConvite} />

        {escala.status !== 'confirmed' && (
          <button
            type="button"
            onClick={() => onChangeStatus(escala.id, 'confirmed')}
            className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-2 text-[13px] font-black text-emerald-700 transition hover:bg-emerald-100"
          >
            Confirmar
          </button>
        )}

        {escala.status !== 'pending' && (
          <button
            type="button"
            onClick={() => onChangeStatus(escala.id, 'pending')}
            className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-2 text-[13px] font-black text-amber-700 transition hover:bg-amber-100"
          >
            Marcar pendente
          </button>
        )}

        {escala.status !== 'declined' && (
          <button
            type="button"
            onClick={() => onChangeStatus(escala.id, 'declined')}
            className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-black text-red-700 transition hover:bg-red-100"
          >
            Recusar
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (confirm('Tem certeza que deseja deletar esta escala?')) {
              onDelete(escala.id);
            }
          }}
          className="rounded-[16px] bg-red-600 px-4 py-2 text-[13px] font-black text-white transition hover:bg-red-700"
        >
          Deletar
        </button>
      </div>
    </div>
  );
}
