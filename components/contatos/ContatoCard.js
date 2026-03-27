'use client';

import { getTagToneClasses, getStatusPillClasses } from '../../lib/contatos/contatos-ui';
import { formatPhoneDisplay } from '../../lib/contatos/contatos-format';

export default function ContatoCard({
  name,
  email,
  phone,
  tag,
  notes,
  isActive,
  initials,
  onEdit,
  onDelete,
  onToggleStatus,
}) {
  return (
    <div className="rounded-[22px] border border-[#edf2f7] bg-[#fcfdff] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-4">
          {/* Avatar */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[14px] font-black text-violet-700">
            {initials}
          </div>

          {/* Info */}
          <div className="min-w-0">
            <div className="text-[15px] font-black text-[#0f172a]">
              {name || 'Sem nome'}
            </div>

            {phone ? (
              <div className="mt-0.5 text-[13px] font-semibold text-[#475569]">
                {formatPhoneDisplay(phone)}
              </div>
            ) : null}

            {email ? (
              <div className="mt-0.5 text-[13px] text-[#64748b]">{email}</div>
            ) : null}

            {notes ? (
              <div className="mt-1 text-[13px] text-[#94a3b8]">{notes}</div>
            ) : null}

            <div className="mt-2 flex flex-wrap gap-2">
              {tag ? (
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${getTagToneClasses(tag)}`}
                >
                  {tag}
                </span>
              ) : null}

              <span
                className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${getStatusPillClasses(isActive)}`}
              >
                {isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 md:shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-[14px] border border-[#dbe3ef] bg-white px-3 py-2 text-[12px] font-black text-[#0f172a]"
          >
            Editar
          </button>

          <button
            type="button"
            onClick={onToggleStatus}
            className="rounded-[14px] border border-[#dbe3ef] bg-white px-3 py-2 text-[12px] font-black text-[#475569]"
          >
            {isActive ? 'Desativar' : 'Ativar'}
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="rounded-[14px] border border-red-100 bg-red-50 px-3 py-2 text-[12px] font-black text-red-600"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
