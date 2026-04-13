import Image from 'next/image';

function Pill({ children, tone = 'default' }) {
  const tones = {
    default: 'border-[#dbe3ef] bg-[#f8fafc] text-[#475569]',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${tones[tone] || tones.default}`}
    >
      {children}
    </span>
  );
}

function formatDateBR(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

function getSongFlags(song) {
  const hasTitle = Boolean(String(song?.title || '').trim());
  const hasArtist = Boolean(String(song?.artist || '').trim());
  const hasThumb = Boolean(song?.thumbnail_url);
  const hasYoutube = Boolean(song?.youtube_id || song?.youtube_url);
  const hasGenre = Boolean(song?.genre?.id);
  const hasMoment = Boolean(song?.moment?.id);

  const hasError = !hasTitle || !hasArtist;
  const isPending = !hasError && (!hasGenre || !hasMoment || !hasYoutube || !hasThumb);

  return {
    hasThumb,
    hasYoutube,
    hasError,
    isPending,
  };
}

export default function SugestaoCard({
  song,
  onEdit,
  onDelete,
  onToggleFeatured,
  onToggleActive,
}) {
  const genreName = song?.genre?.name || 'Sem gênero';
  const tags = (song?.song_tags || []).map((item) => item?.tag?.name).filter(Boolean);
  const safeTitle = String(song?.title || 'Música').trim();
  const { hasThumb, hasYoutube, hasError, isPending } = getSongFlags(song);
  const shouldShowImage = Boolean(song?.thumbnail_url);

  return (
    <article className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.07)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_44px_rgba(15,23,42,0.1)]">
      <div className="relative h-[164px] bg-slate-100">
        {shouldShowImage ? (
          <Image
            src={song.thumbnail_url}
            alt={song.title || 'Música'}
            fill
            sizes="(max-width: 1280px) 100vw, 50vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_20%_20%,#e2e8f0_0%,#cbd5e1_45%,#94a3b8_100%)] px-5 text-center text-[13px] font-black text-slate-700">
            <span className="rounded-full border border-white/60 bg-white/45 px-3 py-1 text-[11px] uppercase tracking-[0.08em] text-slate-600">
              Capa premium
            </span>
            <span className="line-clamp-2 max-w-[90%] text-[14px] tracking-[-0.01em] text-slate-800">
              {safeTitle}
            </span>
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Pill tone={song?.is_active ? 'emerald' : 'red'}>
            {song?.is_active ? 'Ativa' : 'Inativa'}
          </Pill>
          {song?.is_featured ? <Pill tone="violet">Destaque</Pill> : null}
          {isPending ? <Pill tone="amber">Pendente</Pill> : null}
          {hasError ? <Pill tone="red">Com erro</Pill> : null}
        </div>
      </div>

      <div className="space-y-4 p-5">
        <header>
          <h3 className="line-clamp-1 text-[19px] font-black tracking-[-0.02em] text-slate-900">
            {song?.title || 'Sem título'}
          </h3>
          <p className="mt-1 line-clamp-1 text-[14px] font-semibold text-slate-500">
            {song?.artist || 'Artista não informado'}
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          <Pill tone="sky">{genreName}</Pill>
          {!hasYoutube ? <Pill tone="amber">Sem YouTube</Pill> : null}
          {!hasThumb ? <Pill tone="amber">Sem thumb</Pill> : null}
          {tags.slice(0, 3).map((tag) => (
            <Pill key={`${song.id}-${tag}`}>{tag}</Pill>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onEdit(song)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-black text-slate-900"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => onToggleActive(song)}
            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] font-black text-amber-700"
          >
            {song?.is_active ? 'Desativar' : 'Ativar'}
          </button>
          <button
            type="button"
            onClick={() => onToggleFeatured(song)}
            className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-[13px] font-black text-violet-700"
          >
            {song?.is_featured ? 'Remover destaque' : 'Destacar'}
          </button>
          <button
            type="button"
            onClick={() => onDelete(song)}
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] font-black text-red-700"
          >
            Excluir
          </button>
        </div>

        <footer className="text-[12px] font-semibold text-slate-400">
          Atualizada em {formatDateBR(song?.updated_at)}
        </footer>
      </div>
    </article>
  );
}
