'use client';

import { useMemo } from 'react';
import { extractYoutubeId } from '../../lib/membro/membro-invites';

export default function MiniPlayerBar({
  isMiniPlayerVisible = false,
  currentTrack,
  eventTitle,
  isPlaying,
  onExpand,
  onCloseSession,
  onNext,
  onPrev,
  onTogglePlay,
}) {
  const videoId = String(currentTrack?.videoId || '').trim() || extractYoutubeId(currentTrack?.url || '');
  const thumbnailUrl = useMemo(() => {
    if (!videoId) return '';
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }, [videoId]);

  if (!currentTrack || !isMiniPlayerVisible) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] z-[140] px-3 pb-2 md:bottom-4 md:px-6">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(10,14,30,0.96),rgba(29,20,58,0.96))] text-white shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="h-[3px] w-full bg-white/5">
          <div className="h-full w-1/3 bg-[linear-gradient(90deg,#7c3aed,#d946ef)]" />
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onExpand}
            className="relative h-14 w-14 shrink-0 touch-manipulation overflow-hidden rounded-[16px] border border-white/10 bg-black/20 active:scale-[0.98]"
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
                <div className="absolute inset-0 flex items-center justify-center text-[18px] font-black text-white">
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
            className="min-w-0 flex-1 touch-manipulation text-left active:scale-[0.99]"
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

          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={onPrev}
              className="min-h-11 min-w-11 touch-manipulation rounded-[14px] border border-white/10 bg-white/10 px-3 py-3 text-[12px] font-black active:scale-[0.98]"
              aria-label="Faixa anterior"
            >
              ←
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              className="min-h-11 touch-manipulation rounded-[14px] border border-white/10 bg-white/10 px-4 py-3 text-[12px] font-black active:scale-[0.98]"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <button
              type="button"
              onClick={onNext}
              className="min-h-11 min-w-11 touch-manipulation rounded-[14px] border border-white/10 bg-white/10 px-3 py-3 text-[12px] font-black active:scale-[0.98]"
              aria-label="Próxima faixa"
            >
              →
            </button>

            <button
              type="button"
              onClick={onCloseSession}
              className="min-h-11 touch-manipulation rounded-[14px] border border-white/10 bg-white/10 px-4 py-3 text-[12px] font-black active:scale-[0.98]"
            >
              Fechar
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:hidden">
            <button
              type="button"
              onClick={onTogglePlay}
              className="min-h-11 min-w-11 touch-manipulation rounded-[14px] border border-white/10 bg-white/10 px-3 py-3 text-[12px] font-black active:scale-[0.98]"
              aria-label={isPlaying ? 'Pausar faixa' : 'Reproduzir faixa'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>

            <button
              type="button"
              onClick={onCloseSession}
              className="min-h-11 min-w-11 touch-manipulation rounded-[14px] border border-white/10 bg-white/10 px-3 py-3 text-[12px] font-black active:scale-[0.98]"
              aria-label="Fechar player"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
