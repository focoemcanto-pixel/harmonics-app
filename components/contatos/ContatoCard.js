'use client';

import ContatoPill from './ContatoPill';
import { formatPhoneDisplay, formatInitials, getWhatsAppLink } from '../../lib/contatos/contatos-format';
import { getTagTone, getInitialsClasses } from '../../lib/contatos/contatos-ui';

export default function ContatoCard({
  id,
  name,
  email,
  phone,
  tag,
  notes,
  isActive = true,
  onEdit,
  onDelete,
}) {
  const tone = getTagTone(tag);
  const initials = formatInitials(name);
  const whatsappLink = getWhatsAppLink(phone);

  return (
    <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-black ${getInitialsClasses(tone)}`}>
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[17px] font-black text-[#0f172a]">{name || 'Sem nome'}</h3>
            {!isActive && <ContatoPill tone="red">Inativo</ContatoPill>}
            {tag && <ContatoPill tone={tone}>{tag}</ContatoPill>}
          </div>

          <div className="mt-2 space-y-1 text-[14px] text-[#64748b]">
            <p><strong>Email:</strong> {email || '-'}</p>
            <p><strong>WhatsApp:</strong> {formatPhoneDisplay(phone)}</p>
            {notes && <p className="text-[13px] italic text-[#94a3b8]">{notes}</p>}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-2 text-[13px] font-black text-[#0f172a] transition hover:bg-[#f8fafc]"
            >
              Editar
            </button>

            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-2 text-[13px] font-black text-[#0f172a] transition hover:bg-[#f8fafc]"
              >
                WhatsApp
              </a>
            )}

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
    </div>
  );
}
