'use client';

import { useMemo, useState } from 'react';

function formatDateBR(value) {
  if (!value) return '-';
  const [y, m, d] = String(value).split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function formatTimeShort(value) {
  if (!value) return '--:--';
  return String(value).slice(0, 5);
}

function getWeekdayLabel(dateValue) {
  if (!dateValue) return '';
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  const weekdays = [
    'Domingo',
    'Segunda',
    'Terça',
    'Quarta',
    'Quinta',
    'Sexta',
    'Sábado',
  ];
  return weekdays[date.getDay()] || '';
}

function formatEventHeader(dateValue, timeValue) {
  return `${formatDateBR(dateValue)} • ${getWeekdayLabel(dateValue)} • ${formatTimeShort(timeValue)}`;
}

function getDaysDiff(dateValue) {
  if (!dateValue) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [y, m, d] = String(dateValue).split('-').map(Number);
  const eventDate = new Date(y, (m || 1) - 1, d || 1);

  if (Number.isNaN(eventDate.getTime())) return null;

  const diffMs = eventDate.getTime() - today.getTime();
  return Math.round(diffMs / 86400000);
}

function getEventBadge(item) {
  const days = getDaysDiff(item?.eventDate);

  if (item?.isDone) {
    return {
      label: 'Concluído',
      className:
        'border-emerald-400/20 bg-emerald-500/12 text-emerald-300',
    };
  }

  if (days === 0) {
    return {
      label: 'HOJE! ⚡',
      className: 'border-rose-400/20 bg-rose-500/14 text-rose-200',
    };
  }

  if (typeof days === 'number' && days < 0) {
    return {
      label: 'Já passou',
      className:
        'border-emerald-400/20 bg-emerald-500/12 text-emerald-300',
    };
  }

  if (typeof days === 'number' && days === 1) {
    return {
      label: 'Falta 1 dia',
      className:
        'border-violet-400/20 bg-violet-500/14 text-violet-200',
    };
  }

  if (typeof days === 'number' && days > 1) {
    return {
      label: `Faltam ${days} dias`,
      className:
        'border-violet-400/20 bg-violet-500/14 text-violet-200',
    };
  }

  return {
    label: 'Agenda',
    className: 'border-white/10 bg-white/10 text-white/75',
  };
}

function getFormationTone(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized) return 'border-white/10 bg-white/8 text-white/70';
  if (normalized.includes('solo')) return 'border-slate-400/20 bg-slate-500/12 text-slate-200';
  if (normalized.includes('duo')) return 'border-sky-400/20 bg-sky-500/12 text-sky-200';
  if (normalized.includes('trio')) return 'border-violet-400/20 bg-violet-500/12 text-violet-200';
  if (normalized.includes('quarteto')) return 'border-amber-400/20 bg-amber-500/12 text-amber-200';
  if (normalized.includes('quinteto')) return 'border-emerald-400/20 bg-emerald-500/12 text-emerald-200';
  if (normalized.includes('sexteto')) return 'border-pink-400/20 bg-pink-500/12 text-pink-200';

  return 'border-indigo-400/20 bg-indigo-500/12 text-indigo-200';
}

function FormationBadge({ value }) {
  if (!value) return null;

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${getFormationTone(
        value
      )}`}
    >
      {value}
    </span>
  );
}

function MiniStatCard({ value, label, tone = 'default' }) {
  const tones = {
    default: 'border-white/10 bg-white/5 text-white',
    emerald: 'border-emerald-400/15 bg-emerald-500/10 text-emerald-200',
    amber: 'border-amber-400/15 bg-amber-500/10 text-amber-200',
  };

  return (
    <div
      className={`rounded-[18px] border px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${tones[tone] || tones.default}`}
    >
      <div className="text-[11px] font-black uppercase tracking-[0.1em] text-white/55">
        {label}
      </div>
      <div className="mt-1 text-[28px] font-black tracking-[-0.04em]">
        {value}
      </div>
    </div>
  );
}

function MonthNavigator({ label, onPrev, onNext }) {
  return (
    <div className="grid grid-cols-[58px_1fr_58px] items-center gap-3">
      <button
        type="button"
        onClick={onPrev}
        className="flex h-[58px] w-[58px] items-center justify-center rounded-[18px] border border-white/10 bg-white/5 text-[24px] font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.16)] active:scale-[0.98]"
      >
        ‹
      </button>

      <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(139,92,246,0.10))] px-4 py-4 text-center shadow-[0_10px_26px_rgba(0,0,0,0.18)]">
        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-white/45">
          Agenda mensal
        </div>
        <div className="mt-1 text-[24px] font-black tracking-[-0.04em] text-white sm:text-[28px]">
          {label}
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="flex h-[58px] w-[58px] items-center justify-center rounded-[18px] border border-white/10 bg-white/5 text-[24px] font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.16)] active:scale-[0.98]"
      >
        ›
      </button>
    </div>
  );
}

function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <div className="h-px flex-1 bg-white/10" />
      <div className="text-[12px] font-black uppercase tracking-[0.16em] text-white/55">
        {label}
      </div>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}

function ActionButton({ icon, label, onClick, tone = 'default' }) {
  const tones = {
    default: 'border-white/10 bg-white/5 text-white active:scale-[0.985]',
    success:
      'border-emerald-400/25 bg-emerald-500/10 text-emerald-200 active:scale-[0.985]',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[50px] items-center justify-center gap-2 rounded-[16px] border px-3 py-3 text-[13px] font-black transition ${tones[tone] || tones.default}`}
    >
      <span className="shrink-0 text-[15px] leading-none">{icon}</span>
      <span className="leading-none">{label}</span>
    </button>
  );
}
function EventCard({
  item,
  onOpenRepertoire,
  onOpenMaps,
  onOpenScale,
  onMarkDone,
}) {
  const badge = getEventBadge(item);
  const hasSound = !!item?.hasSound;
  const hasReceptivo =
    item?.receptionHours !== '' &&
    item?.receptionHours !== null &&
    item?.receptionHours !== undefined &&
    String(item?.receptionHours) !== '0';

  return (
    <article
      className={`relative overflow-hidden rounded-[26px] border p-4 text-white shadow-[0_16px_34px_rgba(0,0,0,0.18)] ${
        item?.isDone
          ? 'border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.07),rgba(255,255,255,0.03))]'
          : 'border-violet-400/20 bg-[linear-gradient(135deg,rgba(99,65,190,0.18),rgba(255,255,255,0.03))]'
      }`}
    >
      <div
        className={`absolute left-0 top-0 h-full w-[4px] ${
          item?.isDone ? 'bg-emerald-400' : 'bg-violet-400'
        }`}
      />

      <div className="pl-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[14px] font-black tracking-[-0.02em] text-violet-200">
              {formatEventHeader(item?.eventDate, item?.eventTime)}
            </div>
          </div>

          <span
            className={`inline-flex shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-black ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        <h3 className="mt-3 line-clamp-1 text-[24px] font-black tracking-[-0.05em] text-white">
          {item?.clientName || 'Evento'}
        </h3>

        <div className="mt-3 space-y-1.5 text-[14px] leading-5 text-white/74">
          {item?.locationName ? (
            <div className="flex items-start gap-2">
              <span className="mt-[1px] shrink-0">📍</span>
              <span className="line-clamp-1">{item.locationName}</span>
            </div>
          ) : null}

          {item?.instruments ? (
            <div className="flex items-start gap-2">
              <span className="mt-[1px] shrink-0">🎵</span>
              <span className="line-clamp-1">{item.instruments}</span>
            </div>
          ) : null}

          {(hasSound || hasReceptivo) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-white/66">
              {hasSound ? <span>🔊 Com sonorização</span> : null}
              {hasReceptivo ? (
                <span>⏱ Receptivo: {item.receptionHours}h</span>
              ) : null}
            </div>
          )}
        </div>

        <div className="mt-3">
          <FormationBadge value={item?.formation} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
  <ActionButton
    icon="👥"
    label="Escala"
    onClick={() => onOpenScale(item)}
  />

  <ActionButton
    icon="🎼"
    label="Repertório"
    onClick={() => onOpenRepertoire(item)}
  />

  <ActionButton
    icon="🗺️"
    label="Maps"
    onClick={() => onOpenMaps(item)}
  />

  <ActionButton
    icon={item?.isDone ? '✅' : '⬜'}
    label={item?.isDone ? 'Concluído' : 'Marcar'}
    onClick={() => onMarkDone(item)}
    tone={item?.isDone ? 'success' : 'default'}
  />
</div>
      </div>
    </article>
  );
}

function getMonthLabel(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function isSameMonth(dateValue, baseDate) {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  return (
    date.getFullYear() === baseDate.getFullYear() &&
    date.getMonth() === baseDate.getMonth()
  );
}

function sortByEventDateAsc(items = []) {
  return [...items].sort((a, b) => {
    const aTime = new Date(
      `${a?.eventDate || ''}T${a?.eventTime || '00:00:00'}`
    ).getTime();
    const bTime = new Date(
      `${b?.eventDate || ''}T${b?.eventTime || '00:00:00'}`
    ).getTime();

    return aTime - bTime;
  });
}

export default function MembroEscalasTab({
  member,
  confirmados = [],
  onOpenRepertoire,
  onOpenMaps,
  onOpenScale,
  onMarkDone,
}) {
  const initialMonthRef = useMemo(() => {
    const futureOrCurrent = sortByEventDateAsc(confirmados).find((item) => {
      const days = getDaysDiff(item?.eventDate);
      return typeof days === 'number' && days >= -31;
    });

    const base = futureOrCurrent?.eventDate
      ? new Date(`${futureOrCurrent.eventDate}T12:00:00`)
      : new Date();

    return new Date(base.getFullYear(), base.getMonth(), 1);
  }, [confirmados]);

  const [currentMonth, setCurrentMonth] = useState(initialMonthRef);

  const monthItems = useMemo(() => {
    return sortByEventDateAsc(confirmados).filter((item) =>
      isSameMonth(item?.eventDate, currentMonth)
    );
  }, [confirmados, currentMonth]);

  const pendentesDoMes = useMemo(() => {
    return monthItems.filter((item) => !item?.isDone);
  }, [monthItems]);

  const concluidosDoMes = useMemo(() => {
    return monthItems.filter((item) => item?.isDone);
  }, [monthItems]);

  const monthLabel = useMemo(() => {
    const label = getMonthLabel(currentMonth);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [currentMonth]);

  function goPrevMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goNextMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  return (
    <section className="space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(109,40,217,0.16),rgba(255,255,255,0.03))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.20)]">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-black/30 text-center shadow-[0_8px_20px_rgba(0,0,0,0.22)]">
            <span className="font-serif text-[22px] italic text-white">H</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="line-clamp-1 text-[16px] font-black tracking-[-0.03em] text-white md:text-[18px]">
              Harmonics
            </div>
            <div className="line-clamp-1 text-[14px] font-semibold text-white/60">
              {member?.name || 'Membro'} • {member?.tag || 'Member'}
            </div>
          </div>

          <div className="inline-flex rounded-full border border-violet-300/15 bg-violet-400/15 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-violet-100">
            Member
          </div>
        </div>
      </div>

      <MonthNavigator
        label={monthLabel}
        onPrev={goPrevMonth}
        onNext={goNextMonth}
      />

      <div className="grid grid-cols-3 gap-3">
        <MiniStatCard value={monthItems.length} label="eventos" tone="default" />
        <MiniStatCard value={concluidosDoMes.length} label="concluídos" tone="emerald" />
        <MiniStatCard value={pendentesDoMes.length} label="pendentes" tone="amber" />
      </div>

      {monthItems.length === 0 ? (
        <div className="rounded-[26px] border border-dashed border-white/10 bg-white/5 px-5 py-8 text-center text-white">
          <div className="text-[18px] font-black">
            Nenhuma escala neste mês
          </div>
          <p className="mt-2 text-[15px] leading-7 text-white/60">
            Use as setas para navegar entre os meses da sua agenda.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendentesDoMes.length > 0 ? (
            <div className="space-y-3">
              {pendentesDoMes.map((item) => (
                <EventCard
                  key={item.id}
                  item={item}
                  onOpenRepertoire={onOpenRepertoire}
                  onOpenMaps={onOpenMaps}
                  onOpenScale={onOpenScale}
                  onMarkDone={onMarkDone}
                />
              ))}
            </div>
          ) : null}

          {concluidosDoMes.length > 0 ? (
            <div className="space-y-3 pt-2">
              <SectionDivider label="Concluídos" />

              {concluidosDoMes.map((item) => (
                <EventCard
                  key={item.id}
                  item={item}
                  onOpenRepertoire={onOpenRepertoire}
                  onOpenMaps={onOpenMaps}
                  onOpenScale={onOpenScale}
                  onMarkDone={onMarkDone}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
