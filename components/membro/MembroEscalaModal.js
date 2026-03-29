'use client';

function StatusBadge({ status }) {
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

  const tone = map[String(status || 'pending').toLowerCase()] || map.pending;
  const label = labels[String(status || 'pending').toLowerCase()] || 'Pendente';

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${tone}`}>
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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-[3px]">
      <div className="flex min-h-screen items-end justify-center px-0 md:items-center md:px-6">
        <div className="max-h-[88vh] w-full overflow-hidden rounded-t-[28px] border border-white/10 bg-[#111827] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:max-w-2xl md:rounded-[28px]">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/15 md:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[12px] font-black uppercase tracking-[0.12em] text-violet-200/70">
                  Escala do evento
                </div>
                <h3 className="mt-2 text-[28px] font-black tracking-[-0.04em]">
                  {eventTitle || 'Escala'}
                </h3>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-[16px] border border-white/10 bg-white/10 px-4 py-3 text-[14px] font-black text-white"
              >
                Fechar
              </button>
            </div>
          </div>

          <div className="max-h-[68vh] overflow-y-auto px-5 py-5">
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
                          {item.role || item.suggested_role_name || item.contact_tag_text || '-'}
                        </div>
                        <div className="mt-1 text-[13px] text-white/45">
                          {item.musician_phone || item.phone || ''}
                          {(item.musician_phone || item.phone) && (item.musician_email || item.email) ? ' • ' : ''}
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
