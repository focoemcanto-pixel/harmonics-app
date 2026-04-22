'use client';

import { useMemo } from 'react';
import { extractYoutubeId } from '../../lib/membro/membro-invites';

export default function MembroPlayerModal({
  open,
  eventTitle,
  playlist = [],
  currentIndex = 0,
  isPlaying,
  onClose,
  onSelectTrack,
  onPrev,
  onNext,
  onTogglePlay,
}) {
  const currentTrack = playlist[currentIndex] || null;
  const videoId = String(currentTrack?.videoId || '').trim() || extractYoutubeId(currentTrack?.url || '');
  const thumbnailUrl = useMemo(() => {
    if (!videoId) return '';
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }, [videoId]);
  
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-[4px]">
      <div className="flex min-h-[100dvh] items-end justify-center md:min-h-screen md:items-center md:p-6">
        <div className="flex h-[92dvh] w-full min-h-0 flex-col overflow-hidden rounded-t-[30px] border border-white/10 bg-[#0b1020] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:h-auto md:max-h-[92vh] md:max-w-5xl md:rounded-[30px]">
          <div className="shrink-0 border-b border-white/10 px-5 py-4 md:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[12px] font-black uppercase tracking-[0.12em] text-fuchsia-200/70">
                  Playlist do repertório
                </div>
                <h3 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-white">
                  {eventTitle || 'Repertório'}
                </h3>
                <div className="mt-2 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-white/70">
                  {isPlaying ? 'Reproduzindo no player global' : 'Player global pausado'}
                </div>
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

          <div className="flex flex-1 min-h-0 flex-col overflow-y-auto md:grid md:grid-cols-[1.05fr_0.95fr] md:overflow-hidden">
            <div className="min-h-0 border-b border-white/10 p-5 md:overflow-y-auto md:border-b-0 md:border-r md:p-6">
              <div className="flex min-h-0 flex-col gap-5">
                <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(124,58,237,0.16),rgba(255,255,255,0.03))] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.16)]">
                  <div className="text-[12px] font-black uppercase tracking-[0.08em] text-white/50">
                    Tocando agora
                  </div>

                  <div className="mt-3 text-[24px] font-black tracking-[-0.04em] text-white md:text-[28px]">
                    {currentTrack?.title || 'Nenhuma faixa'}
                  </div>

                  {currentTrack?.subtitle ? (
                    <div className="mt-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-fuchsia-200/70">
                      {currentTrack.subtitle}
                    </div>
                  ) : null}

                  {currentTrack?.notes ? (
                    <div className="mt-4 rounded-[18px] border border-white/10 bg-black/10 px-4 py-4 text-[13px] leading-6 text-white/70">
                      <span className="font-black text-white/85">Observação:</span>{' '}
                      {currentTrack.notes}
                    </div>
                  ) : null}
                </div>

                <div className="overflow-hidden rounded-[18px] border border-white/10 bg-black/45">
                  <div className="relative aspect-video w-full">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={currentTrack?.title || 'Thumbnail da faixa'}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : null}

                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.28),rgba(6,8,16,0.92))]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="rounded-full border border-white/20 bg-black/45 px-4 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-white/85">
                        Áudio premium em reprodução
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <button
                    type="button"
                    onClick={onPrev}
                    className="min-w-0 rounded-[18px] border border-white/10 bg-white/10 px-3 py-4 text-[13px] font-black text-white md:px-4 md:text-[14px]"
                  >
                    Anterior
                  </button>

                  <button
                    type="button"
                    onClick={onTogglePlay}
                    className="min-w-0 rounded-[18px] border border-white/10 bg-white/10 px-3 py-4 text-[13px] font-black text-white md:px-4 md:text-[14px]"
                  >
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      currentTrack?.url &&
                      window.open(currentTrack.url, '_blank', 'noopener,noreferrer')
                    }
                    disabled={!currentTrack?.url}
                    className="min-w-0 rounded-[18px] bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-4 text-[13px] font-black text-white disabled:opacity-50 md:px-4 md:text-[14px]"
                  >
                    YouTube
                  </button>

                  <button
                    type="button"
                    onClick={onNext}
                    className="min-w-0 rounded-[18px] border border-white/10 bg-white/10 px-3 py-4 text-[13px] font-black text-white md:px-4 md:text-[14px]"
                  >
                    Próxima
                  </button>
                </div>

                <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/45">
                    Como funciona
                  </div>
                  <div className="mt-2 text-[14px] leading-6 text-white/65">
                    Player global único ativo para modal e minibar, com continuidade total.
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 p-5 md:overflow-y-auto md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[13px] font-black uppercase tracking-[0.08em] text-white/50">
                  Faixas do repertório
                </div>
                <div className="text-[12px] font-semibold text-white/40">
                  {playlist.length} faixa(s)
                </div>
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
                            ? 'border-fuchsia-300/20 bg-fuchsia-400/10 shadow-[0_12px_28px_rgba(217,70,239,0.12)]'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-black ${
                              active
                                ? 'bg-fuchsia-500 text-white'
                                : 'bg-white/10 text-white/80'
                            }`}
                          >
                            {String(index + 1).padStart(2, '0')}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[15px] font-black text-white">
                              {track.title}
                            </div>

                            {track.subtitle ? (
                              <div className="mt-1 truncate text-[12px] font-semibold uppercase tracking-[0.08em] text-white/60">
                                {track.subtitle}
                              </div>
                            ) : null}

                            {track.notes ? (
                              <div className="mt-2 text-[12px] leading-5 text-white/50">
                                {track.notes}
                              </div>
                            ) : null}
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
