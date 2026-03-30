'use client';

import { useMemo } from 'react';
import { formatDateBR, formatTimeShort, getEventTimeBadge } from '../../lib/membro/membro-invites';

function HomeHeader() {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#0f0a1e_0%,#1a1040_50%,#2d1b69_100%)] px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.20)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black">
            <span className="font-serif text-[13px] italic text-white">H</span>
          </div>

          <div className="min-w-0">
            <div className="text-[18px] font-black text-white">Harmonics</div>
            <div className="text-[11px] font-semibold text-[#a89ec8]">
              Member
            </div>
          </div>
        </div>

        <span className="rounded-full bg-gradient-to-r from-violet-600 to-violet-300 px-3 py-1 text-[10px] font-extrabold tracking-[0.05em] text-white">
          MEMBER
        </span>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  tone = 'default',
  onClick,
}) {
  const tones = {
    default: 'border-white/10 bg-white/5 text-white',
    amber: 'border-amber-300/15 bg-amber-400/10 text-amber-100',
    emerald: 'border-emerald-300/15 bg-emerald-400/10 text-emerald-100',
    violet: 'border-violet-300/15 bg-violet-400/10 text-violet-100',
  };

  const content = (
    <div className={`rounded-[18px] border px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.16)] transition active:scale-[0.985] ${tones[tone] || tones.default}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.1em] text-white/60">
        {label}
      </div>
      <div className="mt-2 text-[24px] font-black tracking-[-0.04em]">
        {value}
      </div>
      <div className="mt-1.5 text-[12px] leading-5 text-white/65">
        {helper}
      </div>
    </div>
  );

  if (!onClick) return content;

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left"
    >
      {content}
    </button>
  );
}

function EventSliderCard({ item, onOpen }) {
  const badge = getEventTimeBadge(item);

  const badgeClass =
    badge.tone === 'today'
      ? 'bg-rose-400/15 text-rose-200 border-rose-300/20'
      : badge.tone === 'future' || badge.tone === 'soon'
      ? 'bg-violet-400/15 text-violet-100 border-violet-300/20'
      : badge.tone === 'past'
      ? 'bg-amber-400/15 text-amber-100 border-amber-300/20'
      : 'bg-emerald-400/15 text-emerald-100 border-emerald-300/20';

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="block w-[280px] shrink-0 text-left"
    >
      <article className="rounded-[16px] border border-[#352a55] bg-[#1e1535] p-4 text-white shadow-[0_4px_20px_rgba(0,0,0,.3)] transition active:scale-[0.99]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-black text-violet-300">
              📅 {formatDateBR(item?.eventDate)} • {item?.weekday || '-'} • {formatTimeShort(item?.eventTime)}
            </div>
          </div>

          <span className={`inline-flex shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.06em] ${badgeClass}`}>
            {badge.label}
          </span>
        </div>

        <div className="mt-3 line-clamp-1 text-[18px] font-black tracking-[-0.03em] text-white">
          {item?.clientName || 'Evento'}
        </div>
      </article>
    </button>
  );
}

function EmptyNextEvent({ onGoAgenda }) {
  return (
    <div className="rounded-[16px] border border-dashed border-white/10 bg-white/5 px-5 py-7 text-white">
      <div className="text-[18px] font-black">Nada na agenda por enquanto</div>
      <p className="mt-2 text-[14px] leading-6 text-white/60">
        Quando você confirmar novos eventos, eles aparecem aqui para consulta rápida.
      </p>

      <button
        type="button"
        onClick={onGoAgenda}
        className="mt-4 rounded-[14px] border border-white/10 bg-white/10 px-4 py-3 text-[14px] font-black text-white"
      >
        Abrir agenda
      </button>
    </div>
  );
}

export default function MembroHomeTab({
  resumo,
  proximosConfirmados = [],
  onGoAgenda,
  onGoRepertoire,
  onGoPendentes,
}) {
  const orderedEvents = useMemo(() => {
    return Array.isArray(proximosConfirmados) ? proximosConfirmados : [];
  }, [proximosConfirmados]);

  const openEventDetails = (item) => {
    if (item) {
      onGoRepertoire?.(item);
      return;
    }
    onGoAgenda?.();
  };

  return (
    <section className="space-y-5">
      <HomeHeader />

      <div className="space-y-3">
        <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-200/70">
          Resumo rápido
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard
            label="Solicitações pendentes"
            value={resumo?.pendentes || 0}
            helper="Toque para responder"
            tone="amber"
            onClick={onGoPendentes}
          />

          <SummaryCard
            label="Escalas confirmadas"
            value={resumo?.confirmados || 0}
            helper="Toque para abrir agenda"
            tone="emerald"
            onClick={onGoAgenda}
          />

          <SummaryCard
            label="Repertórios disponíveis"
            value={resumo?.repertorios || 0}
            helper="Toque para estudar"
            tone="violet"
            onClick={() => onGoRepertoire?.()}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-200/70">
            Visão geral
          </div>
          <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-white">
            Início
          </h2>
        </div>

        {orderedEvents.length === 0 ? (
          <EmptyNextEvent onGoAgenda={onGoAgenda} />
        ) : (
          <div className="space-y-3">
            <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
              {orderedEvents.map((item) => (
                <div key={item.id} className="snap-start">
                  <EventSliderCard item={item} onOpen={openEventDetails} />
                </div>
              ))}
            </div>

            <div className="text-[12px] font-semibold text-white/45">
              Deslize para ver os próximos eventos
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
