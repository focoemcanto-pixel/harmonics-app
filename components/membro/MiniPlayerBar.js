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
  currentTrack,
  eventTitle,
  isPlaying,
  onOpen,
  onClose,
  onNext,
  onPrev,
  onTogglePlay,
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
    <div className="fixed inset-x-0 bottom-[84px] z-[140] px-3 pb-2 md:bottom-4 md:px-6">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(10,14,30,0.96),rgba(29,20,58,0.96))] text-white shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="hidden">
          <div ref={playerHostRef} />
        </div>

        <div className="h-[3px] w-full bg-white/5">
          <div className="h-full w-1/3 bg-[linear-gradient(90deg,#7c3aed,#d946ef)]" />
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onOpen}
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
  );
}
