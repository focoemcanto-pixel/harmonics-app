'use client';

import { useEffect, useRef, useMemo } from 'react';
import { extractYoutubeId } from '../../lib/membro/membro-invites';

function ensureYouTubeAPI() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);

    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }

    const existing = document.querySelector('script[data-youtube-iframe-api="true"]');
    if (!existing) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.setAttribute('data-youtube-iframe-api', 'true');
      document.body.appendChild(tag);
    }

    const previous = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous();
      resolve(window.YT || null);
    };

    const checkReady = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(checkReady);
        resolve(window.YT);
      }
    }, 150);

    setTimeout(() => {
      clearInterval(checkReady);
      resolve(window.YT || null);
    }, 10000);
  });
}

export default function MiniPlayerBar({
  expanded = false,
  currentTrack,
  eventTitle,
  playlist = [],
  currentIndex = 0,
  isPlaying,
  onExpand,
  onCollapse,
  onClose,
  onNext,
  onPrev,
  onTogglePlay,
  onSelectTrack,
  onPlayerStateChange,
}) {
  const playerRef = useRef(null);
  const playerHostRef = useRef(null);
  const currentVideoIdRef = useRef('');

  const videoId = extractYoutubeId(currentTrack?.url || '');
  const thumbnailUrl = useMemo(() => {
    if (!videoId) return '';
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }, [videoId]);

  useEffect(() => {
    if (!videoId) return;

    let cancelled = false;

    async function init() {
      const YT = await ensureYouTubeAPI();
      if (!YT || cancelled || !playerHostRef.current) return;

      if (!playerRef.current) {
        playerRef.current = new YT.Player(playerHostRef.current, {
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: (event) => {
              currentVideoIdRef.current = videoId;
              event.target.playVideo();
              onPlayerStateChange?.(true);
            },
            onStateChange: (event) => {
              const state = event?.data;

              if (state === window.YT.PlayerState.PLAYING) {
                onPlayerStateChange?.(true);
              }

              if (
                state === window.YT.PlayerState.PAUSED ||
                state === window.YT.PlayerState.ENDED
              ) {
                onPlayerStateChange?.(false);
              }
            },
          },
        });
        return;
      }

      if (currentVideoIdRef.current !== videoId) {
        currentVideoIdRef.current = videoId;
        playerRef.current.loadVideoById(videoId);
        onPlayerStateChange?.(true);
        return;
      }

      if (isPlaying) {
        playerRef.current.playVideo?.();
      } else {
        playerRef.current.pauseVideo?.();
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [videoId, isPlaying, onPlayerStateChange]);

  if (!currentTrack) return null;

  return (
    <>
      <div className="hidden">
        <div ref={playerHostRef} />
      </div>

      {expanded ? (
        <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-[4px]">
          <div className="flex min-h-screen items-end justify-center md:items-center md:p-6">
            <div className="flex h-[92vh] w-full flex-col overflow-hidden rounded-t-[30px] border border-white/10 bg-[#0b1020] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:h-auto md:max-h-[92vh] md:max-w-5xl md:rounded-[30px]">
              <div className="border-b border-white/10 px-5 py-4 md:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[12px] font-black uppercase tracking-[0.12em] text-fuchsia-200/70">
                      Playlist do repertório
                    </div>
                    <h3 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-white">
                      {eventTitle || 'Repertório'}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={onCollapse}
                    className="rounded-[16px] border border-white/10 bg-white/10 px-4 py-3 text-[14px] font-black text-white"
                  >
                    Fechar
                  </button>
                </div>
              </div>

              <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1.1fr_0.9fr]">
                <div className="border-b border-white/10 p-5 md:border-b-0 md:border-r md:p-6">
                  <div className="overflow-hidden rounded-[26px] border border-white/10 bg-black/20">
                    {thumbnailUrl ? (
                      <div className="relative aspect-video w-full overflow-hidden">
                        <img
                          src={thumbnailUrl}
                          alt={currentTrack?.title || 'Thumbnail'}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/45" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={onTogglePlay}
                            className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15 text-[28px] font-black text-white backdrop-blur"
                          >
                            {isPlaying ? '❚❚' : '▶'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex aspect-video items-center justify-center px-5 text-center text-[15px] font-semibold text-white/60">
                        Nenhuma faixa disponível para tocar neste repertório.
                      </div>
                    )}
                  </div>

                  <div className="mt-5 rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(124,58,237,0.16),rgba(255,255,255,0.03))] p-5">
                    <div className="text-[12px] font-black uppercase tracking-[0.08em] text-white/50">
                      Tocando agora
                    </div>

                    <div className="mt-3 text-[28px] font-black tracking-[-0.04em] text-white">
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

                    <div className="mt-5 grid grid-cols-4 gap-3">
                      <button
                        type="button"
                        onClick={onPrev}
                        className="rounded-[18px] border border-white/10 bg-white/10 px-4 py-4 text-[14px] font-black text-white"
                      >
                        Anterior
                      </button>

                      <button
                        type="button"
                        onClick={onTogglePlay}
                        className="rounded-[18px] border border-white/10 bg-white/10 px-4 py-4 text-[14px] font-black text-white"
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
                        className="rounded-[18px] bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-4 text-[14px] font-black text-white disabled:opacity-50"
                      >
                        YouTube
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
                </div>

                <div className="min-h-0 overflow-y-auto p-5 md:p-6">
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
      ) : null}

      <div className="fixed inset-x-0 bottom-[84px] z-[140] px-3 pb-2 md:bottom-4 md:px-6">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(10,14,30,0.96),rgba(29,20,58,0.96))] text-white shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="h-[3px] w-full bg-white/5">
            <div className="h-full w-1/3 bg-[linear-gradient(90deg,#7c3aed,#d946ef)]" />
          </div>

          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={onExpand}
              className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[16px] border border-white/10 bg-black/20"
              aria-label="Abrir player"
            >
              {thumbnailUrl ? (
                <>
                  <img
                    src={thumbnailUrl}
                    alt={currentTrack?.title || 'Thumbnail'}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30" />
                  <div className="absolute inset-0 flex items-center justify-center text-white text-[18px] font-black">
                    {isPlaying ? '♫' : '▶'}
                  </div>
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[18px] text-white">
                  {isPlaying ? '♫' : '▶'}
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={onExpand}
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
                className="rounded-[14px] border border-white/10 bg-white/10 px-3 py-3 text-[12px] font-black"
              >
                ←
              </button>

              <button
                type="button"
                onClick={onTogglePlay}
                className="rounded-[14px] border border-white/10 bg-white/10 px-4 py-3 text-[12px] font-black"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>

              <button
                type="button"
                onClick={onNext}
                className="rounded-[14px] border border-white/10 bg-white/10 px-3 py-3 text-[12px] font-black"
              >
                →
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-[14px] border border-white/10 bg-white/10 px-4 py-3 text-[12px] font-black"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
