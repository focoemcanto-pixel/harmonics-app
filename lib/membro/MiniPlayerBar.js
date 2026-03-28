'use client';

export default function MiniPlayerBar({
  currentTrack,
  eventTitle,
  onOpen,
  onClose,
  onNext,
}) {
  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[130] mx-auto max-w-3xl">
      <div className="rounded-[24px] border border-white/10 bg-[#101729]/95 px-4 py-3 text-white shadow-[0_18px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpen}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-[16px] font-black text-white"
          >
            ▶
          </button>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-black">
              {currentTrack.title}
            </div>
            <div className="truncate text-[12px] text-white/55">
              {eventTitle || 'Playlist do repertório'}
            </div>
          </div>

          <button
            type="button"
            onClick={onNext}
            className="rounded-[14px] border border-white/10 bg-white/10 px-3 py-2 text-[12px] font-black text-white"
          >
            Próxima
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-[14px] border border-white/10 bg-white/10 px-3 py-2 text-[12px] font-black text-white"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
