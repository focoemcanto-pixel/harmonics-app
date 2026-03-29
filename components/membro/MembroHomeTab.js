'use client';

import { formatDateBR, formatTimeShort, getEventTimeBadge } from '../../lib/membro/membro-invites';

function SummaryCard({ label, value, helper, tone = 'default' }) {
  const tones = {
    default: 'border-white/10 bg-white/5 text-white',
    amber: 'border-amber-300/15 bg-amber-400/10 text-amber-100',
    emerald: 'border-emerald-300/15 bg-emerald-400/10 text-emerald-100',
    violet: 'border-violet-300/15 bg-violet-400/10 text-violet-100',
  };

  return (
    <div className={`rounded-[24px] border p-5 shadow-[0_10px_30px_rgba(15,23,42,0.16)] ${tones[tone] || tones.default}`}>
      <div className="text-[12px] font-black uppercase tracking-[0.1em] text-white/60">
        {label}
      </div>
      <div className="mt-3 text-[30px] font-black tracking-[-0.04em]">
        {value}
      </div>
      <div className="mt-2 text-[13px] leading-6 text-white/65">
        {helper}
      </div>
    </div>
  );
}

function NextEventCard({ item, onGoAgenda, onGoRepertoire }) {
  if (!item) {
    return (
      <div className="rounded-[26px] border border-dashed border-white/10 bg-white/5 px-5 py-8 text-white">
        <div className="text-[18px] font-black">Nada na agenda por enquanto</div>
        <p className="mt-2 text-[15px] leading-7 text-white/60">
          Quando você confirmar novos eventos, eles aparecem aqui como seu próximo compromisso.
        </p>
      </div>
    );
  }

  const badge = getEventTimeBadge(item);

  const badgeClass =
    badge.tone === 'today'
      ? 'bg-rose-400/15 text-rose-200 border-rose-300/20'
      : badge.tone === 'future' || badge.tone === 'soon'
      ? 'bg-violet-400/15 text-violet-100 border-violet-300/20'
      : 'bg-emerald-400/15 text-emerald-100 border-emerald-300/20';

  return (
    <article className="rounded-[30px] border border-white/10 bg-white/5 p-5 text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-200/70">
            Próximo evento
          </div>
          <h3 className="mt-2 text-[28px] font-black tracking-[-0.04em]">
            {item.clientName}
          </h3>
          <div className="mt-3 text-[15px] font-semibold text-white/70">
            {formatDateBR(item.eventDate)} • {item.weekday || '-'} • {formatTimeShort(item.eventTime)}
          </div>
        </div>

        <div className={`inline-flex rounded-full border px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] ${badgeClass}`}>
          {badge.label}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">Local</div>
          <div className="mt-2 text-[15px] font-semibold">{item.locationName || '-'}</div>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">Formação</div>
          <div className="mt-2 text-[15px] font-semibold">{item.formation || '-'}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={onGoAgenda}
          className="rounded-[18px] bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-4 text-[15px] font-black text-white shadow-[0_14px_28px_rgba(139,92,246,0.24)]"
        >
          Abrir agenda
        </button>

        <button
          type="button"
          onClick={onGoRepertoire}
          className="rounded-[18px] border border-white/10 bg-white/10 px-5 py-4 text-[15px] font-black text-white"
        >
          Ver repertório
        </button>
      </div>
    </article>
  );
}

export default function MembroHomeTab({
  resumo,
  proximosConfirmados,
  onGoAgenda,
  onGoRepertoire,
}) {
  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          label="Solicitações pendentes"
          value={resumo?.pendentes || 0}
          helper="Convites aguardando sua resposta."
          tone="amber"
        />
        <SummaryCard
          label="Escalas confirmadas"
          value={resumo?.confirmados || 0}
          helper="Eventos já confirmados por você."
          tone="emerald"
        />
        <SummaryCard
          label="Repertórios disponíveis"
          value={resumo?.repertorios || 0}
          helper="Eventos com material de estudo pronto."
          tone="violet"
        />
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-200/70">
            Visão geral
          </div>
          <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-white">
            Início
          </h2>
        </div>

        <NextEventCard
          item={proximosConfirmados[0]}
          onGoAgenda={onGoAgenda}
          onGoRepertoire={() => onGoRepertoire(proximosConfirmados[0])}
        />
      </div>
    </section>
  );
}
