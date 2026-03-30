'use client';

import { useEffect, useRef } from 'react';
import { extractYoutubeId } from '../../lib/membro/membro-invites';

function ensureYouTubeAPI() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);

    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    document.body.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      resolve(window.YT);
    };
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

  // 🎬 INIT PLAYER (UMA VEZ)
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
            modestbranding: 1,
          },
          events: {
            onReady: (event) => {
              currentVideoIdRef.current = videoId;
              event.target.playVideo();
              onPlayerStateChange?.(true);
            },
            onStateChange: (event) => {
              const state = event.data;

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

      // 🔁 troca de vídeo
      if (currentVideoIdRef.current !== videoId) {
        currentVideoIdRef.current = videoId;
        playerRef.current.loadVideoById(videoId);
        return;
      }

      // ▶️ play/pause sync
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
  }, [videoId]);

  // ▶️ controle play/pause
  useEffect(() => {
    if (!playerRef.current) return;

    if (isPlaying) {
      playerRef.current.playVideo?.();
    } else {
      playerRef.current.pauseVideo?.();
    }
  }, [isPlaying]);

  if (!currentTrack) return null;

  return (
    <div className="fixed inset-x-0 bottom-[84px] z-[140] px-3 pb-2 md:bottom-4 md:px-6">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(10,14,30,0.96),rgba(29,20,58,0.96))] text-white shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">

        {/* 🎬 PLAYER MINI INVISÍVEL */}
        <div className="hidden">
          <div ref={playerHostRef} />
        </div>

        {/* 🎵 UI */}
        <div className="flex items-center gap-3 px-4 py-3">

          {/* ▶️ abrir modal */}
          <button
            type="button"
            onClick={onOpen}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c3aed,#d946ef)] text-[22px] text-white shadow-[0_10px_30px_rgba(124,58,237,0.35)] active:scale-[0.96]"
          >
            {isPlaying ? '♫' : '▶'}
          </button>

          {/* 🎧 infos */}
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

            {currentTrack?.notes && (
              <div className="mt-1 truncate text-[12px] text-white/45">
                {currentTrack.notes}
              </div>
            )}
          </button>

          {/* 🎛 controles */}
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
