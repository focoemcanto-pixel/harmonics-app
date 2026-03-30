'use client';

import { useEffect } from 'react';

function StatusBadge({ status }) {
  const normalized = String(status || 'pending').toLowerCase();

  const tones = {
    confirmed: 'bg-emerald-500/12 text-emerald-300 border-emerald-400/20',
    pending: 'bg-amber-500/12 text-amber-300 border-amber-400/20',
    declined: 'bg-red-500/12 text-red-300 border-red-400/20',
    backup: 'bg-sky-500/12 text-sky-300 border-sky-400/20',
  };

  const labels = {
    confirmed: 'Confirmado',
    pending: 'Pendente',
    declined: 'Recusado',
    backup: 'Reserva',
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${
        tones[normalized] || tones.pending
      }`}
    >
      {labels[normalized] || 'Pendente'}
    </span>
  );
}

function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }

  return (parts[0] || 'M').slice(0, 2).toUpperCase();
}

function MusicianRow({ item }) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-[#1e1535] px-4 py-3 shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c3aed,#a78bfa)] text-[13px] font-black text-white">
          {getInitials(item?.musician_name || item?.name || 'Membro')}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-extrabold text-white">
            {item?.musician_name || item?.name || 'Membro'}
          </div>

          <div className="mt-0.5 truncate text-[12px] font-semibold text-white/65">
            {item?.role || item?.suggested_role_name || item?.contact_tag_text || '-'}
          </div>

          {(item?.musician_phone || item?.phone || item?.musician_email || item?.email) ? (
            <div className="mt-1 truncate text-[12px] text-white/40">
              {[item?.musician_phone || item?.phone || '', item?.musician_email || item?.email || '']
                .filter(Boolean)
                .join(' • ')}
            </div>
          ) : null}
        </div>

        <StatusBadge status={item?.status} />
      </div>
    </div>
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
      className="fixed inset-0 z-[180] bg-black/70 backdrop-blur-[4px]"
      onClick={handleBackdropClick}
    >
      <div className="flex h-[100dvh] items-end justify-center overflow-hidden px-0">
        <div
          className="flex h-[92dvh] w-full max-w-[500px] flex-col overflow-hidden rounded-t-[22px] border border-white/10 bg-[#1a1230] text-white shadow-[0_24px_80px_rgba(0,0,0,0.42)] md:my-6 md:h-auto md:max-h-[88vh] md:rounded-[20px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0">
            <div className="mx-auto mt-3 h-1 w-9 rounded-full bg-white/15" />

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#1a1230] px-5 py-4">
              <div className="min-w-0">
                <div className="text-[18px] font-black tracking-[-0.03em] text-white">
                  👥 Escala
                </div>
                <div className="mt-1 truncate text-[12px] font-semibold text-white/55">
                  {eventTitle || 'Evento'}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-[12px] border border-white/10 bg-[#241b3d] px-3 py-2 text-[13px] font-extrabold text-white transition active:scale-[0.98]"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            {musicians.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-white/10 bg-white/5 px-4 py-5 text-center text-[14px] font-semibold text-white/55">
                Nenhum membro escalado neste evento.
              </div>
            ) : (
              <div className="space-y-2">
                {musicians.map((item, index) => (
                  <MusicianRow
                    key={`${item?.id || item?.musician_id || index}`}
                    item={item}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
