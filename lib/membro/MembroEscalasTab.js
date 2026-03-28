'use client';

import { addHoursToTime, formatDateBR } from '../../lib/membro/membro-invites';

function EmptyState() {
  return (
    <div className="rounded-[26px] border border-dashed border-white/10 bg-white/5 px-5 py-8 text-center text-white">
      <div className="text-[18px] font-black">Nenhuma escala confirmada</div>
      <p className="mt-2 text-[15px] leading-7 text-white/60">
        Quando você aceitar uma solicitação, ela aparece aqui como sua agenda.
      </p>
    </div>
  );
}

function EventCard({ item, onOpenRepertoire, onOpenPdf }) {
  const chegada = addHoursToTime(item.eventTime, -2);

  return (
    <article className="rounded-[28px] border border-white/10 bg-white/5 p-5 text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)] backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-[12px] font-black uppercase tracking-[0.12em] text-emerald-200/80">
            Minha escala
          </div>

          <h3 className="mt-2 text-[24px] font-black tracking-[-0.04em]">
            {item.clientName}
          </h3>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-emerald-100">
              Confirmado
            </span>

            {item.suggestedRoleName ? (
              <span className="inline-flex rounded-full border border-violet-300/15 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-violet-100">
                {item.suggestedRoleName}
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-[20px] border border-white/10 bg-black/10 px-4 py-3 text-[13px] font-semibold text-white/70">
          Respondido em {item.respondedAt ? new Date(item.respondedAt).toLocaleDateString('pt-BR') : '-'}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
            Data e hora
          </div>
          <div className="mt-2 text-[15px] font-semibold">
            {formatDateBR(item.eventDate)} • {String(item.eventTime || '--:--').slice(0, 5)}
          </div>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
            Chegada
          </div>
          <div className="mt-2 text-[15px] font-semibold">
            {chegada}
          </div>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
            Local
          </div>
          <div className="mt-2 text-[15px] font-semibold">
            {item.locationName || '-'}
          </div>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
            Formação
          </div>
          <div className="mt-2 text-[15px] font-semibold">
            {item.formation || '-'}
          </div>
        </div>
      </div>

      {item.instruments ? (
        <div className="mt-4 rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
            Instrumentos esperados
          </div>
          <div className="mt-2 text-[14px] leading-7 text-white/85">
            {item.instruments}
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => onOpenRepertoire(item)}
          className="rounded-[18px] bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-4 text-[15px] font-black text-white shadow-[0_14px_28px_rgba(139,92,246,0.24)]"
        >
          Ver repertório
        </button>

        <button
          type="button"
          onClick={() => onOpenRepertoire(item, { autoplay: true })}
          className="rounded-[18px] border border-white/10 bg-white/10 px-5 py-4 text-[15px] font-black text-white"
        >
          Abrir player
        </button>

        <button
          type="button"
          onClick={() => onOpenPdf(item)}
          disabled={!item.contractInfo?.pdfUrl}
          className="rounded-[18px] border border-white/10 bg-white/10 px-5 py-4 text-[15px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Baixar PDF
        </button>
      </div>
    </article>
  );
}

export default function MembroEscalasTab({
  confirmados,
  onOpenRepertoire,
  onOpenPdf,
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
        <EmptyState />
      ) : (
        confirmados.map((item) => (
          <EventCard
            key={item.id}
            item={item}
            onOpenRepertoire={onOpenRepertoire}
            onOpenPdf={onOpenPdf}
          />
        ))
      )}
    </section>
  );
}
