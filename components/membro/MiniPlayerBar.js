'use client';

export default function MiniPlayerBar({
  currentTrack,
  eventTitle,
  isPlaying,
  onOpen,
  onClose,
  onNext,
  onPrev,
  onTogglePlay,
}) {
  if (!currentTrack) return null;

  return (
    <div className="fixed inset-x-0 bottom-[84px] z-[140] px-3 pb-2 md:bottom-4 md:px-6">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(10,14,30,0.96),rgba(29,20,58,0.96))] text-white shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="h-[3px] w-full bg-white/5">
          <div className="h-full w-1/3 bg-[linear-gradient(90deg,#7c3aed,#d946ef)]" />
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onOpen}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c3aed,#d946ef)] text-[22px] text-white shadow-[0_10px_30px_rgba(124,58,237,0.35)] transition active:scale-[0.96]"
            aria-label="Abrir player"
          >
            {isPlaying ? '♫' : '▶'}
          </button>

          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 text-left"
          >
            <div className="truncate text-[15px] font-black text-white">
              {currentTrack?.title || 'Faixa atual'}
            </div>

            <div className="mt-0.5 truncate text-[12px] font-semibold uppercase tracking-[0.06em] text-fuchsia-200/70">
              {currentTrack?.subtitle || eventTitle || 'Repertório'}
            </div>

            {currentTrack?.notes ? (
              <div className="mt-1 truncate text-[12px] text-white/45">
                {currentTrack.notes}
              </div>
            ) : null}
          </button>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              className="rounded-[14px] border border-white/10 bg-white/10 px-3 py-3 text-[12px] font-black text-white transition active:scale-[0.97]"
            >
              ←
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              className="rounded-[14px] border border-white/10 bg-white/10 px-4 py-3 text-[12px] font-black text-white transition active:scale-[0.97]"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <button
              type="button"
              onClick={onNext}
              className="rounded-[14px] border border-white/10 bg-white/10 px-3 py-3 text-[12px] font-black text-white transition active:scale-[0.97]"
            >
              →
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-[14px] border border-white/10 bg-white/10 px-4 py-3 text-[12px] font-black text-white transition active:scale-[0.97]"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
