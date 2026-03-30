'use client';

import { useMemo, useState } from 'react';
import { formatDateBR, formatTimeShort } from '../../lib/membro/membro-invites';

function getMonthLabel(date) {
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(date);

  return label.charAt(0).toUpperCase() + label.slice(1);
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

      <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(217,70,239,0.10))] px-4 py-4 text-center shadow-[0_10px_26px_rgba(0,0,0,0.18)]">
        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-white/45">
          Repertórios do mês
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

function EmptyState() {
  return (
    <div className="rounded-[26px] border border-dashed border-white/10 bg-white/5 px-5 py-8 text-center text-white">
      <div className="text-[18px] font-black">Nenhum repertório neste mês</div>
      <p className="mt-2 text-[15px] leading-7 text-white/60">
        Use as setas para navegar entre os meses e encontrar outros eventos.
      </p>
    </div>
  );
}

function getStatus(item) {
  const hasRepertorio =
    Array.isArray(item?.repertorioItems) && item.repertorioItems.length > 0;
  const hasLinks =
    Array.isArray(item?.youtubeUrls) && item.youtubeUrls.length > 0;
  const hasPdf = !!item?.contractInfo?.pdfUrl;

  if (hasRepertorio || hasLinks || hasPdf) {
    return {
      label: 'Disponível',
      className: 'bg-emerald-500/12 text-emerald-300 border-emerald-400/20',
    };
  }

  return {
    label: 'Não enviado',
    className: 'bg-white/10 text-white/65 border-white/10',
  };
}

function RepertoireCard({ item, onOpenRepertoire }) {
  const status = getStatus(item);

  return (
    <button
      type="button"
      onClick={() => onOpenRepertoire(item)}
      className="block w-full text-left"
    >
      <article className="rounded-[16px] border border-white/10 bg-[#1e1535] px-4 py-4 text-white shadow-[0_8px_20px_rgba(0,0,0,0.20)] transition active:scale-[0.995]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-black text-fuchsia-200">
              {formatDateBR(item?.eventDate)} • {formatTimeShort(item?.eventTime)}
            </div>

            <div className="mt-2 truncate text-[18px] font-black tracking-[-0.03em] text-white">
              {item?.clientName || 'Evento'}
            </div>
          </div>

          <span
            className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${status.className}`}
          >
            {status.label}
          </span>
        </div>
      </article>
    </button>
  );
}

export default function MembroRepertoriosTab({
  repertorios = [],
  onOpenRepertoire,
}) {
  const initialMonthRef = useMemo(() => {
    const ordered = sortByEventDateAsc(repertorios);
    const firstItem = ordered[0];

    const base = firstItem?.eventDate
      ? new Date(`${firstItem.eventDate}T12:00:00`)
      : new Date();

    return new Date(base.getFullYear(), base.getMonth(), 1);
  }, [repertorios]);

  const [currentMonth, setCurrentMonth] = useState(initialMonthRef);

  const monthItems = useMemo(() => {
    return sortByEventDateAsc(repertorios).filter((item) =>
      isSameMonth(item?.eventDate, currentMonth)
    );
  }, [repertorios, currentMonth]);

  const disponiveis = monthItems.filter((item) => {
    const hasRepertorio =
      Array.isArray(item?.repertorioItems) && item.repertorioItems.length > 0;
    const hasLinks =
      Array.isArray(item?.youtubeUrls) && item.youtubeUrls.length > 0;
    const hasPdf = !!item?.contractInfo?.pdfUrl;

    return hasRepertorio || hasLinks || hasPdf;
  });

  const pendentes = monthItems.filter((item) => !disponiveis.includes(item));

  const monthLabel = useMemo(() => {
    return getMonthLabel(currentMonth);
  }, [currentMonth]);

  function goPrevMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goNextMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  return (
    <section className="space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(217,70,239,0.10),rgba(255,255,255,0.03))] p-5 shadow-[0_16px_34px_rgba(15,23,42,0.16)]">
        <div className="text-[12px] font-black uppercase tracking-[0.14em] text-fuchsia-200/70">
          Estudo
        </div>

        <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-white">
          Repertórios
        </h2>
      </div>

      <MonthNavigator
        label={monthLabel}
        onPrev={goPrevMonth}
        onNext={goNextMonth}
      />

      <div className="grid grid-cols-3 gap-3">
        <MiniStatCard value={monthItems.length} label="eventos" />
        <MiniStatCard value={disponiveis.length} label="disponíveis" tone="emerald" />
        <MiniStatCard value={pendentes.length} label="pendentes" tone="amber" />
      </div>

      {monthItems.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {monthItems.map((item) => (
            <RepertoireCard
              key={item.id}
              item={item}
              onOpenRepertoire={onOpenRepertoire}
            />
          ))}
        </div>
      )}
    </section>
  );
}
