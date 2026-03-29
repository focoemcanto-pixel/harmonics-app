'use client';

import MembroResumoCards from './MembroResumoCards';
import { formatDateBR, formatTimeShort } from '../../lib/membro/membro-invites';

function QuickActionCard({ title, helper, actionLabel, onAction, tone = 'violet' }) {
  const toneMap = {
    violet: 'from-violet-500/16 to-fuchsia-500/10 border-violet-300/12',
    amber: 'from-amber-500/14 to-orange-500/10 border-amber-300/12',
    emerald: 'from-emerald-500/14 to-green-500/10 border-emerald-300/12',
  };

  return (
    <div className={`rounded-[26px] border bg-gradient-to-br p-5 text-white ${toneMap[tone] || toneMap.violet}`}>
      <div className="text-[18px] font-black">{title}</div>
      <p className="mt-2 text-[14px] leading-7 text-white/65">{helper}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 rounded-[16px] bg-white/10 px-4 py-3 text-[14px] font-black text-white"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function NextEventCard({ item, onOpenRepertoire, onOpenPdf, onOpenMaps }) {
  return (
    <article className="rounded-[28px] border border-white/10 bg-white/5 p-5 text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)] backdrop-blur">
      <div className="text-[12px] font-black uppercase tracking-[0.12em] text-violet-200/75">
        Próximo compromisso
      </div>

      <h3 className="mt-2 text-[24px] font-black tracking-[-0.04em]">
        {item.clientName}
      </h3>

      <div className="mt-3 text-[15px] font-semibold leading-7 text-white/70">
        {formatDateBR(item.eventDate)} • {formatTimeShort(item.eventTime)}
        {item.locationName ? ` • ${item.locationName}` : ''}
      </div>

      <div className="mt-2 text-[14px] leading-7 text-white/65">
        {item.formation || 'Sem formação definida'}
        {item.suggestedRoleName ? ` • ${item.suggestedRoleName}` : ''}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => onOpenRepertoire(item)}
          className="rounded-[18px] bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-4 text-[15px] font-black text-white"
        >
          Ver repertório
        </button>

        <button
          type="button"
          onClick={() => onOpenMaps(item)}
          className="rounded-[18px] border border-white/10 bg-white/10 px-5 py-4 text-[15px] font-black text-white"
        >
          Abrir Maps
        </button>

        <button
          type="button"
          onClick={() => onOpenPdf(item)}
          disabled={!item.contractInfo?.pdfUrl}
          className="rounded-[18px] border border-white/10 bg-white/10 px-5 py-4 text-[15px] font-black text-white disabled:opacity-50"
        >
          PDF
        </button>
      </div>
    </article>
  );
}

export default function MembroHomeTab({
  resumo,
  proximasEscalas,
  pendentes,
  onGoTab,
  onOpenRepertoire,
  onOpenPdf,
  onOpenMaps,
}) {
  const nextEvent = proximasEscalas[0] || null;

  return (
    <section className="space-y-5">
      <MembroResumoCards resumo={resumo} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QuickActionCard
          title="Solicitações pendentes"
          helper="Veja rapidamente quem está aguardando sua resposta e resolva em poucos toques."
          actionLabel={`Abrir solicitações (${pendentes.length})`}
          onAction={() => onGoTab('solicitacoes')}
          tone="amber"
        />

        <QuickActionCard
          title="Seu modo ensaio"
          helper="Acesse repertórios, PDF e player das músicas sem sair do painel."
          actionLabel="Abrir repertórios"
          onAction={() => onGoTab('repertorios')}
          tone="violet"
        />
      </div>

      {nextEvent ? (
        <NextEventCard
          item={nextEvent}
          onOpenRepertoire={onOpenRepertoire}
          onOpenPdf={onOpenPdf}
          onOpenMaps={onOpenMaps}
        />
      ) : null}
    </section>
  );
}
