'use client';

import { buildYoutubeEmbedUrl } from '../../lib/membro/membro-invites';

export default function MembroPlayerModal({
  open,
  eventTitle,
  playlist = [],
  currentIndex = 0,
  onClose,
  onSelectTrack,
  onPrev,
  onNext,
}) {
  if (!open) return null;

  const currentTrack = playlist[currentIndex] || null;
  const embedUrl = currentTrack?.url ? buildYoutubeEmbedUrl(currentTrack.url) : '';

  return (
    <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-[3px]">
      <div className="flex min-h-screen items-end justify-center md:items-center md:p-6">
        <div className="flex h-[92vh] w-full flex-col overflow-hidden rounded-t-[30px] border border-white/10 bg-[#0b1020] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:h-auto md:max-h-[92vh] md:max-w-5xl md:rounded-[30px]">
          <div className="border-b border-white/10 px-5 py-4 md:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[12px] font-black uppercase tracking-[0.12em] text-fuchsia-200/70">
                  Playlist do repertório
                </div>
                <h3 className="mt-2 text-[28px] font-black tracking-[-0.04em]">
                  {eventTitle || 'Repertório'}
                </h3>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-[16px] border border-white/10 bg-white/10 px-4 py-3 text-[14px] font-black text-white"
              >
                Fechar
              </button>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1.35fr_0.95fr]">
            <div className="border-b border-white/10 p-5 md:border-b-0 md:border-r md:p-6">
              <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
                {embedUrl ? (
                  <iframe
                    src={embedUrl}
                    title={currentTrack?.title || 'YouTube player'}
                    className="aspect-video w-full"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center px-5 text-center text-[15px] font-semibold text-white/60">
                    Nenhuma faixa disponível para tocar neste repertório.
                  </div>
                )}
              </div>

              <div className="mt-5">
                <div className="text-[13px] font-black uppercase tracking-[0.08em] text-white/50">
                  Tocando agora
                </div>
                <div className="mt-2 text-[22px] font-black">
                  {currentTrack?.title || 'Nenhuma faixa'}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={onPrev}
                  className="rounded-[18px] border border-white/10 bg-white/10 px-4 py-4 text-[14px] font-black text-white"
                >
                  Anterior
                </button>

                <button
                  type="button"
                  onClick={() => currentTrack?.url && window.open(currentTrack.url, '_blank', 'noopener,noreferrer')}
                  disabled={!currentTrack?.url}
                  className="rounded-[18px] bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-4 text-[14px] font-black text-white disabled:opacity-50"
                >
                  Abrir no YouTube
                </button>

                <button
                  type="button"
                  onClick={onNext}
                  className="rounded-[18px] border border-white/10 bg-white/10 px-4 py-4 text-[14px] font-black text-white"
                >
                  Próxima
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-5 md:p-6">
              <div className="text-[13px] font-black uppercase tracking-[0.08em] text-white/50">
                Faixas do repertório
              </div>

              <div className="mt-4 space-y-3">
                {playlist.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-white/10 bg-white/5 px-4 py-5 text-[14px] font-semibold text-white/60">
                    Nenhuma faixa encontrada.
                  </div>
                ) : (
                  playlist.map((track, index) => {
                    const active = index === currentIndex;

                    return (
                      <button
                        key={`${track.url}-${index}`}
                        type="button"
                        onClick={() => onSelectTrack(index)}
                        className={`block w-full rounded-[22px] border px-4 py-4 text-left transition ${
                          active
                            ? 'border-fuchsia-300/20 bg-fuchsia-400/10'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-black ${
                            active ? 'bg-fuchsia-500 text-white' : 'bg-white/10 text-white/80'
                          }`}>
                            {String(index + 1).padStart(2, '0')}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-[15px] font-black text-white">
                              {track.title}
                            </div>
                            <div className="mt-1 truncate text-[13px] text-white/55">
                              {track.url}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
