'use client';

function EmptyState() {
  return (
    <div className="rounded-[26px] border border-dashed border-white/10 bg-white/5 px-5 py-8 text-center text-white">
      <div className="text-[18px] font-black">Nenhum repertório disponível</div>
      <p className="mt-2 text-[15px] leading-7 text-white/60">
        Os repertórios aparecem aqui quando houver PDF do evento ou links de estudo disponíveis.
      </p>
    </div>
  );
}

function RepertoireCard({
  item,
  onOpenRepertoire,
  onOpenPdf,
}) {
  const tracksCount = item.youtubeUrls?.length || 0;
  const hasPdf = !!item.contractInfo?.pdfUrl;

  return (
    <article className="rounded-[28px] border border-white/10 bg-white/5 p-5 text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)] backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-[12px] font-black uppercase tracking-[0.12em] text-fuchsia-200/80">
            Repertório do evento
          </div>

          <h3 className="mt-2 text-[24px] font-black tracking-[-0.04em]">
            {item.clientName}
          </h3>

          <div className="mt-3 flex flex-wrap gap-2">
            {hasPdf ? (
              <span className="inline-flex rounded-full border border-sky-300/15 bg-sky-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-sky-100">
                PDF disponível
              </span>
            ) : null}

            {tracksCount > 0 ? (
              <span className="inline-flex rounded-full border border-fuchsia-300/15 bg-fuchsia-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-fuchsia-100">
                {tracksCount} faixa(s)
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
            Formação
          </div>
          <div className="mt-2 text-[15px] font-semibold">
            {item.formation || '-'}
          </div>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-black/10 px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/50">
            Instrumentos
          </div>
          <div className="mt-2 text-[14px] leading-7 text-white/85">
            {item.instruments || '-'}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => onOpenRepertoire(item)}
          className="rounded-[18px] bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-4 text-[15px] font-black text-white shadow-[0_14px_28px_rgba(139,92,246,0.24)]"
        >
          Visualizar repertório
        </button>

        <button
          type="button"
          onClick={() => onOpenRepertoire(item, { autoplay: true })}
          disabled={tracksCount === 0}
          className="rounded-[18px] border border-white/10 bg-white/10 px-5 py-4 text-[15px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ir para o player
        </button>

        <button
          type="button"
          onClick={() => onOpenPdf(item)}
          disabled={!hasPdf}
          className="rounded-[18px] border border-white/10 bg-white/10 px-5 py-4 text-[15px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Baixar PDF
        </button>
      </div>
    </article>
  );
}

export default function MembroRepertoriosTab({
  repertorios,
  onOpenRepertoire,
  onOpenPdf,
}) {
  return (
    <section className="space-y-4">
      <div>
        <div className="text-[12px] font-black uppercase tracking-[0.14em] text-fuchsia-200/70">
          Estudo
        </div>
        <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-white">
          Repertórios
        </h2>
      </div>

      {repertorios.length === 0 ? (
        <EmptyState />
      ) : (
        repertorios.map((item) => (
          <RepertoireCard
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
