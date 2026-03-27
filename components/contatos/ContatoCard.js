// components/contatos/ContatoCard.js
'use client';

import { formatPhoneDisplay, formatDateBR, getInitials } from '../../lib/contatos/contatos-format';
import { getTagToneClasses, getStatusPillClasses } from '../../lib/contatos/contatos-ui';

export default function ContatoCard({
  id,
  name,
  email,
  phone,
  tag,
  notes,
  isActive,
  createdAt,
  onEdit,
  onDelete,
  onToggleStatus,
}) {
  const initials = getInitials(name);
  const phoneDisplay = formatPhoneDisplay(phone);
  const createdAtDisplay = formatDateBR(createdAt);

  const whatsappHref = phone
    ? `https://wa.me/55${phone.replace(/\D/g, '')}`
    : null;

  return (
    <article className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] transition hover:shadow-[0_14px_32px_rgba(17,24,39,0.08)] md:p-6">
      <div className="flex items-start gap-4">
        {/* Avatar com iniciais */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xl font-black text-violet-700">
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          {/* Nome e status */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-[18px] font-black text-[#0f172a]">{name || 'Sem nome'}</h3>

            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${getStatusPillClasses(isActive)}`}>
              {isActive ? 'Ativo' : 'Inativo'}
            </span>
          </div>

          {/* Tag */}
          {tag && (
            <div className="mb-3">
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${getTagToneClasses(tag)}`}>
                {tag}
              </span>
            </div>
          )}

          {/* Informações principais */}
          <div className="mb-4 space-y-1 text-[14px] text-[#64748b]">
            {email && (
              <p>
                <strong>Email:</strong>{' '}
                <a href={`mailto:${email}`} className="text-violet-600 hover:underline">
                  {email}
                </a>
              </p>
            )}

            {phone && (
              <p>
                <strong>Telefone:</strong> {phoneDisplay}
              </p>
            )}

            {notes && (
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px] italic text-slate-600">
                {notes}
              </p>
            )}

            {createdAt && (
              <p className="text-[12px] text-slate-400">
                Adicionado em {createdAtDisplay}
              </p>
            )}
          </div>

          {/* Ações */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-2 text-[13px] font-black text-[#0f172a] transition hover:bg-slate-50"
            >
              Editar
            </button>

            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-2 text-[13px] font-black text-[#0f172a] transition hover:bg-slate-50"
              >
                WhatsApp
              </a>
            )}

            {email && (
              <a
                href={`mailto:${email}`}
                className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-2 text-[13px] font-black text-[#0f172a] transition hover:bg-slate-50"
              >
                Email
              </a>
            )}

            <button
              type="button"
              onClick={onToggleStatus}
              className={`rounded-[16px] px-4 py-2 text-[13px] font-black transition ${
                isActive
                  ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              {isActive ? 'Desativar' : 'Reativar'}
            </button>

            <button
              type="button"
              onClick={onDelete}
              className="rounded-[16px] bg-red-600 px-4 py-2 text-[13px] font-black text-white transition hover:bg-red-700"
            >
              Excluir
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
