'use client';

import { useMemo, useState } from 'react';
import {
  addHoursToTime,
  formatDateBR,
  formatTimeShort,
} from '../../lib/membro/membro-invites';

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

function isEventPast(item) {
  if (!item?.eventDate) return false;

  const now = new Date();
  const eventDateTime = new Date(
    `${item.eventDate}T${item.eventTime || '23:59:59'}`
  );

  if (Number.isNaN(eventDateTime.getTime())) return false;
  return eventDateTime.getTime() < now.getTime();
}

function isEventDone(item) {
  return !!item?.isDone || isEventPast(item);
}

function getCountdown(item) {
  const days = getDaysDiff(item?.eventDate);
  const done = isEventDone(item);

  if (done) {
    return {
      label: 'Concluído',
      className: 'bg-emerald-500/12 text-emerald-300 border-emerald-400/20',
    };
  }

  if (days === 0) {
    return {
      label: 'HOJE! ⚡',
      className: 'bg-rose-500/14 text-rose-200 border-rose-400/20',
    };
  }

  if (days === 1) {
    return {
      label: 'Amanhã! ⚡',
      className: 'bg-rose-500/14 text-rose-200 border-rose-400/20',
    };
  }

  if (typeof days === 'number' && days < 0) {
    return {
      label: 'Concluído',
      className: 'bg-emerald-500/12 text-emerald-300 border-emerald-400/20',
    };
  }

  if (typeof days === 'number' && days <= 7) {
    return {
      label: `Em ${days} dias`,
      className: 'bg-amber-500/14 text-amber-200 border-amber-400/20',
    };
  }

  if (typeof days === 'number') {
    return {
      label: `Em ${days} dias`,
      className: 'bg-violet-500/14 text-violet-200 border-violet-400/20',
    };
  }

  return {
    label: 'Agenda',
    className: 'bg-white/10 text-white/70 border-white/10',
  };
}

function getFormationTone(value) {
  const s = String(value || '').toLowerCase();

  if (s.includes('sexteto')) return 'bg-pink-500/12 text-pink-200 border-pink-400/20';
  if (s.includes('quinteto')) return 'bg-emerald-500/12 text-emerald-200 border-emerald-400/20';
  if (s.includes('quarteto')) return 'bg-amber-500/12 text-amber-200 border-amber-400/20';
  if (s.includes('trio')) return 'bg-violet-500/12 text-violet-200 border-violet-400/20';
  if (s.includes('duo')) return 'bg-sky-500/12 text-sky-200 border-sky-400/20';
  if (s.includes('solo')) return 'bg-slate-500/12 text-slate-200 border-slate-400/20';

  return 'bg-violet-500/12 text-violet-200 border-violet-400/20';
}

function MonthChip({ value, label, tone = 'default' }) {
  const tones = {
    default: 'text-white',
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
  };

  return (
    <div className="flex items-center gap-2 whitespace-nowrap rounded-[12px] border border-[#352a55] bg-[#1e1535] px-4 py-3 text-[13px] font-extrabold shadow-[0_4px_20px_rgba(0,0,0,.22)]">
      <span className={`text-[18px] font-black ${tones[tone] || tones.default}`}>
        {value}
      </span>
      <span className="text-white/82">{label}</span>
    </div>
  );
}

function MonthPicker({
  open,
  currentMonth,
  onClose,
  onApplyMonth,
  onApplyDate,
}) {
  const [tempYear, setTempYear] = useState(currentMonth.getFullYear());
  const [tempMonth, setTempMonth] = useState(currentMonth.getMonth() + 1);
  const [tempDate, setTempDate] = useState('');

  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  if (!open) return null;

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose?.();
  }

  return (
    <div
      className="fixed inset-0 z-[155] bg-black/70 backdrop-blur-[4px]"
      onClick={handleBackdropClick}
    >
      <div className="flex h-[100dvh] items-end justify-center overflow-hidden px-0 md:items-center md:px-6">
        <div
          className="flex h-[78dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#1a1230] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:h-auto md:max-h-[88vh] md:rounded-[28px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 border-b border-white/10 px-5 py-4">
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/15 md:hidden" />
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[12px] font-black uppercase tracking-[0.12em] text-violet-200/70">
                  Navegação da agenda
                </div>
                <div className="mt-1 text-[20px] font-black">Escolher mês ou data</div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-[14px] border border-white/10 bg-[#241b3d] px-4 py-2 text-[13px] font-extrabold"
              >
                Fechar
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="space-y-5">
              <div className="rounded-[20px] border border-white/10 bg-[#1e1535] p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.1em] text-white/45">
                  Seleção rápida
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="space-y-2">
                    <span className="text-[12px] font-bold text-white/65">Ano</span>
                    <input
                      type="number"
                      value={tempYear}
                      onChange={(e) =>
                        setTempYear(Number(e.target.value || new Date().getFullYear()))
                      }
                      className="w-full rounded-[14px] border border-white/10 bg-[#241b3d] px-4 py-3 text-[15px] font-extrabold text-white outline-none"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[12px] font-bold text-white/65">Mês</span>
                    <select
                      value={tempMonth}
                      onChange={(e) => setTempMonth(Number(e.target.value))}
                      className="w-full rounded-[14px] border border-white/10 bg-[#241b3d] px-4 py-3 text-[15px] font-extrabold text-white outline-none"
                    >
                      {months.map((month, index) => (
                        <option key={month} value={index + 1}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onApplyMonth?.(tempYear, tempMonth);
                    onClose?.();
                  }}
                  className="mt-4 w-full rounded-[16px] bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-4 text-[15px] font-black text-white"
                >
                  Ir para mês selecionado
                </button>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-[#1e1535] p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.1em] text-white/45">
                  Data específica
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                  <input
                    type="date"
                    value={tempDate}
                    onChange={(e) => setTempDate(e.target.value)}
                    className="rounded-[14px] border border-white/10 bg-[#241b3d] px-4 py-3 text-[15px] font-extrabold text-white outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      if (!tempDate) return;
                      onApplyDate?.(tempDate);
                      onClose?.();
                    }}
                    className="rounded-[16px] border border-white/10 bg-white/10 px-5 py-4 text-[14px] font-black text-white"
                  >
                    Ir para data
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventActionButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-[12px] border border-[#352a55] bg-[#241b3d] px-3 py-2 text-[12px] font-extrabold text-[#f1eeff] transition active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 px-1 pt-2">
      <div className="h-px flex-1 bg-white/10" />
      <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-white/40">
        {label}
      </div>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}

function EventCard({
  item,
  onOpenScale,
  onOpenRepertoire,
  onOpenMaps,
  onOpenDetails,
}) {
  const countdown = getCountdown(item);
  const done = isEventDone(item);
  const arrivalTime = addHoursToTime(item?.eventTime, -2);
  const formationTone = getFormationTone(item?.formation);

  return (
    <article
      onClick={() => onOpenDetails?.(item)}
      className={`relative overflow-hidden rounded-[18px] border p-[18px] text-[#f1eeff] shadow-[0_4px_20px_rgba(0,0,0,.3)] transition active:scale-[0.995] xl:rounded-[22px] xl:p-[20px] ${
        done
          ? 'border-emerald-400/25 bg-[linear-gradient(135deg,rgba(34,197,94,.06),#1e1535)]'
          : 'border-[#352a55] bg-[#1e1535]'
      }`}
    >
      <div
        className={`absolute left-0 top-0 h-full w-[4px] ${
          done ? 'bg-emerald-500' : 'bg-violet-500'
        }`}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-black tracking-[-0.02em] text-white xl:text-[16px]">
            📅 {formatDateBR(item?.eventDate)} • {getWeekdayLabel(item?.eventDate)} •{' '}
            {formatTimeShort(item?.eventTime)}
          </div>
        </div>

        <div
          className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold ${countdown.className}`}
        >
          {countdown.label}
        </div>
      </div>

      <div className="mt-3 text-[17px] font-black tracking-[-0.02em] xl:text-[19px]">
        {done ? '✅ ' : ''}
        {item?.clientName || 'Evento'}
      </div>

      <div className="mt-2 flex items-start gap-2 text-[13px] font-semibold text-[#a89ec8] xl:text-[14px]">
        <span className="shrink-0">📍</span>
        <span className="line-clamp-1">{item?.locationName || '-'}</span>
      </div>

      <div className="mt-1 flex items-start gap-2 text-[13px] font-semibold text-[#a89ec8] xl:text-[14px]">
        <span className="shrink-0">🎵</span>
        <span className="line-clamp-1">{item?.instruments || item?.formation || '-'}</span>
      </div>

      <div className="mt-1 flex items-start gap-2 text-[13px] font-semibold text-[#a89ec8] xl:text-[14px]">
        <span className="shrink-0">🕑</span>
        <span>Chegada às {arrivalTime}</span>
      </div>

      {item?.receptionHours ? (
        <div className="mt-1 flex items-start gap-2 text-[13px] font-semibold text-[#a89ec8] xl:text-[14px]">
          <span className="shrink-0">🕓</span>
          <span>Receptivo: {item.receptionHours}h</span>
        </div>
      ) : null}

      {item?.hasSound ? (
        <div className="mt-1 flex items-start gap-2 text-[13px] font-semibold text-[#a89ec8] xl:text-[14px]">
          <span className="shrink-0">🔊</span>
          <span>Com sonorização</span>
        </div>
      ) : null}

      <span
        className={`mt-3 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-extrabold ${formationTone}`}
      >
        🎼 {item?.formation || '-'}
      </span>

      <div className="mt-[14px] flex flex-wrap gap-2">
        <EventActionButton onClick={() => onOpenScale(item)}>
          👥 Escala
        </EventActionButton>

        <EventActionButton onClick={() => onOpenRepertoire(item)}>
          🎼 Repertório
        </EventActionButton>

        <EventActionButton onClick={() => onOpenMaps(item)}>
          🗺 Maps
        </EventActionButton>
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
}) {
  const baseMonth = useMemo(() => {
    const nearest = sortByEventDateAsc(confirmados).find((item) => {
      const days = getDaysDiff(item?.eventDate);
      return typeof days === 'number' && days >= -31;
    });

    const base = nearest?.eventDate
      ? new Date(`${nearest.eventDate}T12:00:00`)
      : new Date();

    return new Date(base.getFullYear(), base.getMonth(), 1);
  }, [confirmados]);

  const [currentMonth, setCurrentMonth] = useState(baseMonth);
  const [pickerOpen, setPickerOpen] = useState(false);

  const monthItems = useMemo(() => {
    return sortByEventDateAsc(confirmados).filter((item) =>
      isSameMonth(item?.eventDate, currentMonth)
    );
  }, [confirmados, currentMonth]);

  const hojeDoMes = useMemo(
    () =>
      monthItems.filter((item) => {
        const days = getDaysDiff(item?.eventDate);
        return days === 0 && !isEventDone(item);
      }),
    [monthItems]
  );

  const proximosDoMes = useMemo(
    () =>
      monthItems.filter((item) => {
        const days = getDaysDiff(item?.eventDate);
        return typeof days === 'number' && days > 0 && !isEventDone(item);
      }),
    [monthItems]
  );

  const concluidosDoMes = useMemo(
    () => monthItems.filter((item) => isEventDone(item)),
    [monthItems]
  );

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

  function applyMonth(year, month) {
    setCurrentMonth(new Date(year, month - 1, 1));
  }

  function applyDate(dateValue) {
    const date = new Date(`${dateValue}T12:00:00`);
    if (Number.isNaN(date.getTime())) return;
    setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  function handleOpenDetails(item) {
    onOpenScale?.(item);
  }

  return (
    <section className="space-y-4 xl:space-y-5">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#0f0a1e_0%,#1a1040_50%,#2d1b69_100%)] px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.20)] xl:px-6 xl:py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black xl:h-10 xl:w-10">
              <span className="font-serif text-[13px] italic text-white xl:text-[14px]">H</span>
            </div>

            <div className="min-w-0">
              <div className="text-[18px] font-black text-white xl:text-[20px]">Harmonics</div>
              <div className="text-[11px] font-semibold text-[#a89ec8] xl:text-[12px]">
                {member?.name || 'Membro'} • Member
              </div>
            </div>
          </div>

          <span className="rounded-full bg-gradient-to-r from-violet-600 to-violet-300 px-3 py-1 text-[10px] font-extrabold tracking-[0.05em] text-white">
            MEMBER
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[56px_1fr_56px] items-center gap-4 px-1 xl:grid-cols-[64px_1fr_64px]">
        <button
          type="button"
          onClick={goPrevMonth}
          className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-[#352a55] bg-[#1e1535] text-[20px] font-extrabold text-white active:scale-[0.95] xl:h-16 xl:w-16 xl:text-[22px]"
        >
          ◀
        </button>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full rounded-[12px] border border-[#352a55] bg-[#1e1535] px-4 py-4 text-center text-[20px] font-black text-white shadow-[0_4px_20px_rgba(0,0,0,.24)] xl:py-5 xl:text-[24px]"
        >
          {monthLabel}
        </button>

        <button
          type="button"
          onClick={goNextMonth}
          className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-[#352a55] bg-[#1e1535] text-[20px] font-extrabold text-white active:scale-[0.95] xl:h-16 xl:w-16 xl:text-[22px]"
        >
          ▶
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto px-1 pb-1">
        <MonthChip value={monthItems.length} label="eventos" />
        <MonthChip value={hojeDoMes.length} label="hoje" tone="rose" />
        <MonthChip value={proximosDoMes.length} label="próximos" tone="amber" />
        <MonthChip value={concluidosDoMes.length} label="concluídos" tone="emerald" />
      </div>

      {monthItems.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-[15px] font-bold text-white/60">
          Nenhuma escala em {monthLabel}
        </div>
      ) : (
        <div className="space-y-3">
          {hojeDoMes.length > 0 ? <SectionDivider label="⚡ Hoje" /> : null}
          {hojeDoMes.map((item) => (
            <EventCard
              key={item.id}
              item={item}
              onOpenScale={onOpenScale}
              onOpenRepertoire={onOpenRepertoire}
              onOpenMaps={onOpenMaps}
              onOpenDetails={handleOpenDetails}
            />
          ))}

          {proximosDoMes.length > 0 ? <SectionDivider label="🗓 Próximos" /> : null}
          {proximosDoMes.map((item) => (
            <EventCard
              key={item.id}
              item={item}
              onOpenScale={onOpenScale}
              onOpenRepertoire={onOpenRepertoire}
              onOpenMaps={onOpenMaps}
              onOpenDetails={handleOpenDetails}
            />
          ))}

          {concluidosDoMes.length > 0 ? <SectionDivider label="✅ Concluídos" /> : null}
          {concluidosDoMes.map((item) => (
            <EventCard
              key={item.id}
              item={item}
              onOpenScale={onOpenScale}
              onOpenRepertoire={onOpenRepertoire}
              onOpenMaps={onOpenMaps}
              onOpenDetails={handleOpenDetails}
            />
          ))}
        </div>
      )}

      <MonthPicker
        open={pickerOpen}
        currentMonth={currentMonth}
        onClose={() => setPickerOpen(false)}
        onApplyMonth={applyMonth}
        onApplyDate={applyDate}
      />
    </section>
  );
}
