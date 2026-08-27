'use client';

import { useMemo, useState } from 'react';
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
  const [collapsed, setCollapsed] = useState(false);
  const videoId = String(currentTrack?.videoId || '').trim() || extractYoutubeId(currentTrack?.url || '');
  const thumbnailUrl = useMemo(() => {
    if (!videoId) return '';
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }, [videoId]);

  if (!currentTrack || !isMiniPlayerVisible) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="Mostrar mini player"
        className="fixed right-0 top-[42%] z-[145] flex h-16 w-12 items-center justify-center rounded-l-[18px] border border-r-0 border-violet-300/20 bg-[linear-gradient(180deg,rgba(47,31,86,0.98),rgba(13,17,34,0.98))] text-[22px] text-white shadow-[-8px_12px_32px_rgba(0,0,0,0.38)] backdrop-blur-xl active:scale-[0.98]"
      >
        {isPlaying ? '♫' : '▶'}
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+82px)] z-[140] px-3 pb-2 md:bottom-4 md:px-6">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(10,14,30,0.98),rgba(37,23,68,0.98))] text-white shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-xl">
        <div className="h-[3px] w-full bg-white/5">
          <div className={`h-full bg-[linear-gradient(90deg,#7c3aed,#d946ef)] ${isPlaying ? 'w-2/3 animate-pulse' : 'w-1/3'}`} />
        </div>

        <div className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
          <button
            type="button"
            onClick={onExpand}
            className="relative h-13 w-13 shrink-0 touch-manipulation overflow-hidden rounded-[15px] border border-white/10 bg-black/20 active:scale-[0.98]"
            aria-label="Abrir player completo"
          >
            {thumbnailUrl ? <img src={thumbnailUrl} alt={currentTrack?.title || 'Thumbnail'} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[18px] text-white">♫</div>}
            <div className="pointer-events-none absolute inset-0 bg-black/25" />
          </button>

          <button type="button" onClick={onExpand} className="min-w-0 flex-1 touch-manipulation text-left active:scale-[0.99]">
            <div className="truncate text-[14px] font-black text-white">{currentTrack?.title || 'Faixa atual'}</div>
            <div className="mt-0.5 truncate text-[10px] font-black uppercase tracking-[0.07em] text-fuchsia-200/65">{currentTrack?.subtitle || eventTitle || 'Repertório'}</div>
          </button>

          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={(e) => { e.stopPropagation(); onPrev?.(); }} className="flex h-10 w-9 items-center justify-center rounded-[13px] border border-white/10 bg-white/8 text-[17px] font-black active:scale-95 sm:w-10" aria-label="Faixa anterior">‹</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onTogglePlay?.(); }} className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white text-[16px] font-black text-[#151024] shadow-[0_8px_20px_rgba(255,255,255,0.12)] active:scale-95" aria-label={isPlaying ? 'Pausar faixa' : 'Reproduzir faixa'}>{isPlaying ? '⏸' : '▶'}</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onNext?.(); }} className="flex h-10 w-9 items-center justify-center rounded-[13px] border border-white/10 bg-white/8 text-[17px] font-black active:scale-95 sm:w-10" aria-label="Próxima faixa">›</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); setCollapsed(true); }} className="flex h-10 w-8 items-center justify-center rounded-[13px] border border-white/10 bg-white/5 text-[13px] font-black text-white/70 active:scale-95" aria-label="Recolher mini player">→</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onCloseSession?.(); }} className="hidden h-10 w-9 items-center justify-center rounded-[13px] border border-white/10 bg-white/5 text-[12px] font-black text-white/55 active:scale-95 sm:flex" aria-label="Encerrar player">✕</button>
          </div>
        </div>
      </div>
    </div>
  );
}
