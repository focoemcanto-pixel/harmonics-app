'use client';

function formatDateBR(value) {
  if (!value) return '-';
  const [y, m, d] = String(value).split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function formatEventHeader(dateValue, timeValue) {
  if (!dateValue) return '-';
  const date = new Date(`${dateValue}T12:00:00`);
  const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const weekday = weekdays[date.getDay()] || '';
  const time = timeValue ? String(timeValue).slice(0, 5) : '--:--';
  return `${formatDateBR(dateValue)} • ${weekday} • ${time}`;
}

function getDaysDiff(dateValue) {
  if (!dateValue) return null;

  const today = new Date();
  const todaySafe = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [y, m, d] = String(dateValue).split('-').map(Number);
  const eventDate = new Date(y, (m || 1) - 1, d || 1);

  const diffMs = eventDate.getTime() - todaySafe.getTime();
  return Math.round(diffMs / 86400000);
}

function getEventBadge(item) {
  const days = getDaysDiff(item.eventDate);

  if (item.isDone) {
    return {
      label: 'Concluído',
      className: 'bg-emerald-500/15 text-emerald-300',
    };
  }

  if (days === 0) {
    return {
      label: 'HOJE! ⚡',
      className: 'bg-red-500/15 text-red-300',
    };
  }

  if (typeof days === 'number' && days < 0) {
    return {
      label: 'Já passou',
      className: 'bg-emerald-500/15 text-emerald-300',
    };
  }

  if (typeof days === 'number') {
    return {
      label: days === 1 ? 'Falta 1 dia' : `Faltam ${days} dias`,
      className: 'bg-violet-500/15 text-violet-200',
    };
  }

  return {
    label: 'Agenda',
    className: 'bg-white/10 text-white/70',
  };
}

function FormationBadge({ value }) {
  if (!value) return null;

  return (
    <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-cyan-200">
      {value}
    </span>
  );
}

function ActionButton({ children, onClick, tone = 'default' }) {
  const tones = {
    default: 'border-white/10 bg-white/5 text-white',
    success: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[18px] border px-4 py-4 text-[14px] font-black transition hover:bg-white/10 ${tones[tone] || tones.default}`}
    >
      {children}
    </button>
  );
}

export default function MembroEscalasTab({
  confirmados,
  onOpenRepertoire,
  onOpenPdf,
  onOpenMaps,
  onOpenScale,
  onMarkDone,
}) {
  return (
    <section className="space-y-4">
      <div>
        <div className="text-[12px] font-black uppercase tracking-[0.14em] text-emerald-200/70">
          Agenda
        </div>
        <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-white">
          Minhas escalas
        </h2>
      </div>

      {confirmados.length === 0 ? (
        <div className="rounded-[26px] border border-dashed border-white/10 bg-white/5 px-5 py-8 text-center text-white">
          <div className="text-[18px] font-black">Nenhuma escala confirmada</div>
          <p className="mt-2 text-[15px] leading-7 text-white/60">
            Quando você aceitar uma solicitação, ela aparece aqui como sua agenda.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {confirmados.map((item) => {
            const badge = getEventBadge(item);
            const hasSound = !!item.hasSound;
            const hasReceptivo = !!item.receptionHours;

            return (
              <article
                key={item.id}
                className={`rounded-[28px] border p-5 text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)] backdrop-blur ${
                  item.isDone
                    ? 'border-emerald-400/25 bg-[linear-gradient(135deg,rgba(16,185,129,0.10),rgba(255,255,255,0.03))]'
                    : 'border-violet-400/20 bg-[linear-gradient(135deg,rgba(139,92,246,0.12),rgba(255,255,255,0.03))]'
                }`}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[14px] font-black tracking-[-0.01em] text-violet-200">
                        {formatEventHeader(item.eventDate, item.eventTime)}
                      </div>

                      <h3 className="mt-3 text-[26px] font-black tracking-[-0.04em]">
                        {item.clientName}
                      </h3>
                    </div>

                    <span className={`inline-flex shrink-0 rounded-full px-3 py-2 text-[12px] font-black ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="space-y-2 text-[15px] text-white/75">
                    {item.locationName ? (
                      <div className="flex items-start gap-2">
                        <span>📍</span>
                        <span>{item.locationName}</span>
                      </div>
                    ) : null}

                    {item.instruments ? (
                      <div className="flex items-start gap-2">
                        <span>🎵</span>
                        <span>{item.instruments}</span>
                      </div>
                    ) : null}

                    {hasSound ? (
                      <div className="flex items-start gap-2">
                        <span>🔊</span>
                        <span>Com sonorização</span>
                      </div>
                    ) : null}

                    {hasReceptivo ? (
                      <div className="flex items-start gap-2">
                        <span>⏱</span>
                        <span>Receptivo: {item.receptionHours}h</span>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <FormationBadge value={item.formation} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <ActionButton onClick={() => onOpenScale(item)}>
                      👥 Escala
                    </ActionButton>

                    <ActionButton onClick={() => onOpenRepertoire(item)}>
                      🎼 Repertório
                    </ActionButton>

                    <ActionButton onClick={() => onOpenMaps(item)}>
                      🗺️ Maps
                    </ActionButton>

                    <ActionButton
                      onClick={() => onMarkDone(item)}
                      tone={item.isDone ? 'success' : 'default'}
                    >
                      {item.isDone ? '✅ Concluído' : '⬜ Marcar'}
                    </ActionButton>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
