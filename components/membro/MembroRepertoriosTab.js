'use client';

function EmptyState() {
  return (
    <div className="rounded-[28px] border border-dashed border-white/10 bg-white/5 px-5 py-9 text-center text-white shadow-[0_16px_34px_rgba(15,23,42,0.14)]">
      <div className="text-[18px] font-black">Nenhum repertório disponível</div>
      <p className="mt-2 text-[15px] leading-7 text-white/60">
        Os repertórios aparecem aqui quando houver material enviado pelo cliente
        ou links de estudo disponíveis para este evento.
      </p>
    </div>
  );
}

function getStudyStatus(item) {
  const tracksCount = Array.isArray(item?.youtubeUrls) ? item.youtubeUrls.length : 0;
  const hasPdf = !!item?.contractInfo?.pdfUrl;
  const repertorioCount = Array.isArray(item?.repertorioItems) ? item.repertorioItems.length : 0;

  if (repertorioCount > 0 && tracksCount > 0) {
    return {
      label: 'Pronto para estudo',
      className: 'border-emerald-400/20 bg-emerald-500/12 text-emerald-200',
    };
  }

  if (repertorioCount > 0 || tracksCount > 0 || hasPdf) {
    return {
      label: 'Material parcial',
      className: 'border-amber-400/20 bg-amber-500/12 text-amber-200',
    };
  }

  return {
    label: 'Aguardando envio',
    className: 'border-white/10 bg-white/10 text-white/65',
  };
}

function buildStudySummary(item) {
  const repertorioCount = Array.isArray(item?.repertorioItems) ? item.repertorioItems.length : 0;
  const tracksCount = Array.isArray(item?.youtubeUrls) ? item.youtubeUrls.length : 0;
  const hasPdf = !!item?.contractInfo?.pdfUrl;

  if (repertorioCount > 0) {
    return `${repertorioCount} item(ns) no roteiro`;
  }

  if (tracksCount > 0 && hasPdf) {
    return `${tracksCount} faixa(s) + PDF`;
  }

  if (tracksCount > 0) {
    return `${tracksCount} faixa(s) para estudar`;
  }

  if (hasPdf) {
    return 'PDF disponível para consulta';
  }

  return 'Ainda sem material enviado';
}

function MiniInfo({ label, value }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.1em] text-white/45">
        {label}
      </div>
      <div className="mt-1 text-[14px] font-semibold text-white/88">
        {value || '-'}
      </div>
    </div>
  );
}

function ResourcePill({ children, tone = 'default' }) {
  const tones = {
    default: 'border-white/10 bg-white/8 text-white/72',
    violet: 'border-violet-300/15 bg-violet-400/10 text-violet-100',
    sky: 'border-sky-300/15 bg-sky-400/10 text-sky-100',
    emerald: 'border-emerald-300/15 bg-emerald-400/10 text-emerald-100',
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${tones[tone] || tones.default}`}
    >
      {children}
    </span>
  );
}

function ActionButton({ label, onClick, disabled = false, tone = 'default' }) {
  const tones = {
    primary:
      'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-[0_14px_28px_rgba(139,92,246,0.24)]',
    default:
      'border border-white/10 bg-white/10 text-white',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-[18px] px-4 py-4 text-[15px] font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === 'primary' ? tones.primary : tones.default
      }`}
    >
      {label}
    </button>
  );
}

function RepertoireCard({ item, onOpenRepertoire, onOpenPdf }) {
  const tracksCount = Array.isArray(item?.youtubeUrls) ? item.youtubeUrls.length : 0;
  const hasPdf = !!item?.contractInfo?.pdfUrl;
  const repertorioCount = Array.isArray(item?.repertorioItems) ? item.repertorioItems.length : 0;
  const status = getStudyStatus(item);
  const summary = buildStudySummary(item);

  return (
    <article className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(168,85,247,0.08))] p-5 text-white shadow-[0_16px_36px_rgba(15,23,42,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-black uppercase tracking-[0.12em] text-fuchsia-200/75">
            Repertório do evento
          </div>

          <h3 className="mt-2 line-clamp-1 text-[24px] font-black tracking-[-0.04em]">
            {item.clientName || 'Evento'}
          </h3>

          <div className="mt-2 text-[14px] font-semibold text-white/62">
            {summary}
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {repertorioCount > 0 ? (
          <ResourcePill tone="emerald">
            {repertorioCount} item(ns)
          </ResourcePill>
        ) : null}

        {tracksCount > 0 ? (
          <ResourcePill tone="violet">
            {tracksCount} faixa(s)
          </ResourcePill>
        ) : null}

        {hasPdf ? (
          <ResourcePill tone="sky">
            PDF disponível
          </ResourcePill>
        ) : null}

        {!repertorioCount && !tracksCount && !hasPdf ? (
          <ResourcePill>
            Sem material ainda
          </ResourcePill>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <MiniInfo label="Formação" value={item.formation || '-'} />
        <MiniInfo label="Instrumentos" value={item.instruments || '-'} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <ActionButton
          label="Visualizar repertório"
          onClick={() => onOpenRepertoire(item)}
          tone="primary"
        />

        <ActionButton
          label="Ir para o player"
          onClick={() => onOpenRepertoire(item, { autoplay: true })}
          disabled={tracksCount === 0}
        />

        <ActionButton
          label="Baixar PDF"
          onClick={() => onOpenPdf(item)}
          disabled={!hasPdf}
        />
      </div>
    </article>
  );
}

export default function MembroRepertoriosTab({
  repertorios = [],
  onOpenRepertoire,
  onOpenPdf,
}) {
  const totalComPlayer = repertorios.filter(
    (item) => Array.isArray(item?.youtubeUrls) && item.youtubeUrls.length > 0
  ).length;

  const totalComPdf = repertorios.filter(
    (item) => !!item?.contractInfo?.pdfUrl
  ).length;

  return (
    <section className="space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(217,70,239,0.10),rgba(255,255,255,0.03))] p-5 shadow-[0_16px_34px_rgba(15,23,42,0.16)]">
        <div className="text-[12px] font-black uppercase tracking-[0.14em] text-fuchsia-200/70">
          Estudo
        </div>

        <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-white">
          Repertórios
        </h2>

        <p className="mt-2 max-w-2xl text-[14px] leading-7 text-white/62">
          Use esta área para revisar o material enviado pelos clientes, ouvir as
          faixas em sequência e acessar rapidamente o repertório de cada evento.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.1em] text-white/45">
              Eventos
            </div>
            <div className="mt-1 text-[26px] font-black tracking-[-0.04em]">
              {repertorios.length}
            </div>
          </div>

          <div className="rounded-[18px] border border-violet-300/10 bg-violet-400/10 px-4 py-3 text-violet-100">
            <div className="text-[10px] font-black uppercase tracking-[0.1em] text-violet-100/70">
              Com player
            </div>
            <div className="mt-1 text-[26px] font-black tracking-[-0.04em]">
              {totalComPlayer}
            </div>
          </div>

          <div className="rounded-[18px] border border-sky-300/10 bg-sky-400/10 px-4 py-3 text-sky-100">
            <div className="text-[10px] font-black uppercase tracking-[0.1em] text-sky-100/70">
              Com PDF
            </div>
            <div className="mt-1 text-[26px] font-black tracking-[-0.04em]">
              {totalComPdf}
            </div>
          </div>
        </div>
      </div>

      {repertorios.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {repertorios.map((item) => (
            <RepertoireCard
              key={item.id}
              item={item}
              onOpenRepertoire={onOpenRepertoire}
              onOpenPdf={onOpenPdf}
            />
          ))}
        </div>
      )}
    </section>
  );
}
