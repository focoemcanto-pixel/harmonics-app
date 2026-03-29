'use client';

import { useEffect } from 'react';

function StatusBadge({ status }) {
  const normalized = String(status || 'pending').toLowerCase();

  const map = {
    confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    pending: 'border-amber-200 bg-amber-50 text-amber-700',
    declined: 'border-red-200 bg-red-50 text-red-700',
    backup: 'border-sky-200 bg-sky-50 text-sky-700',
  };

  const labels = {
    confirmed: 'Confirmado',
    pending: 'Pendente',
    declined: 'Recusado',
    backup: 'Reserva',
  };

  const tone = map[normalized] || map.pending;
  const label = labels[normalized] || 'Pendente';

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${tone}`}
    >
      {label}
    </span>
  );
}

export default function MembroEscalaModal({
  open,
  eventTitle,
  musicians = [],
  onClose,
}) {
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyTouchAction = document.body.style.touchAction;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.touchAction = previousBodyTouchAction;
    };
  }, [open]);

  if (!open) return null;

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/75 backdrop-blur-[4px]"
      onClick={handleBackdropClick}
    >
      <div className="flex h-[100dvh] items-end justify-center overflow-hidden px-0 md:items-center md:px-6">
        <div
          className="flex h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#111827] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:h-auto md:max-h-[88vh] md:max-w-2xl md:rounded-[28px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 border-b border-white/10 px-5 py-4">
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/15 md:hidden" />

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[12px] font-black uppercase tracking-[0.12em] text-violet-200/70">
                  Escala do evento
                </div>

                <h3 className="mt-2 line-clamp-2 text-[26px] font-black tracking-[-0.04em] md:text-[28px]">
                  {eventTitle || 'Escala'}
                </h3>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-[16px] border border-white/10 bg-white/10 px-4 py-3 text-[14px] font-black text-white"
              >
                Fechar
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
            {musicians.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-white/5 px-4 py-5 text-[14px] font-semibold text-white/60">
                Nenhum membro escalado neste evento.
              </div>
            ) : (
              <div className="space-y-3">
                {musicians.map((item, index) => (
                  <div
                    key={`${item.id || item.musician_id || index}`}
                    className="rounded-[22px] border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="text-[18px] font-black text-white">
                          {item.musician_name || item.name || 'Membro'}
                        </div>

                        <div className="mt-1 text-[14px] font-semibold text-white/70">
                          {item.role ||
                            item.suggested_role_name ||
                            item.contact_tag_text ||
                            '-'}
                        </div>

                        <div className="mt-1 text-[13px] text-white/45">
                          {item.musician_phone || item.phone || ''}
                          {(item.musician_phone || item.phone) &&
                          (item.musician_email || item.email)
                            ? ' • '
                            : ''}
                          {item.musician_email || item.email || ''}
                        </div>
                      </div>

                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
