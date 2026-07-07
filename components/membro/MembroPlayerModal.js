'use client';

import { useEffect, useMemo } from 'react';
import { extractYoutubeId } from '../../lib/membro/membro-invites';

const CONTROL_BUTTON_CLASS = 'min-h-12 min-w-0 touch-manipulation rounded-[18px] px-3 py-4 text-[13px] font-black text-white transition active:scale-[0.98]';
const TRACK_BUTTON_BASE_CLASS = 'block min-h-16 w-full touch-manipulation rounded-[22px] border px-4 py-4 text-left transition active:scale-[0.99]';

function YoutubePlaybackFrame({ videoId, title, isPlaying, thumbnailUrl }) {
  const embedSrc = useMemo(() => {
    if (!videoId || !isPlaying) return '';
    const params = new URLSearchParams({
      autoplay: '1',
      playsinline: '1',
      rel: '0',
      modestbranding: '1',
      controls: '1',
      enablejsapi: '1',
    });
    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
  }, [videoId, isPlaying]);

  return (
    <div className="w-full overflow-hidden rounded-[18px] border border-white/10 bg-black/45">
      <div className="relative aspect-video w-full">
        {embedSrc ? (
          <iframe
            key={`${videoId}-playing`}
            src={embedSrc}
            title={title || 'Player do repertório'}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <>
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={title || 'Thumbnail da faixa'}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.28),rgba(6,8,16,0.92))]" />
            <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
              <div className="rounded-full border border-white/20 bg-black/45 px-4 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-white/85">
                Toque em Play para iniciar o áudio
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PlayerStatusBadge({ isPlaying }) {
  return (
    <div className="inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-white/70">
      {isPlaying ? 'Player do YouTube ativo' : 'Player pausado'}
    </div>
  );
}

function NowPlayingCard({ currentTrack }) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(124,58,237,0.16),rgba(255,255,255,0.03))] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.16)]">
      <div className="text-[12px] font-black uppercase tracking-[0.08em] text-white/50">
        Tocando agora
      </div>

      <div className="mt-3 break-words text-[24px] font-black tracking-[-0.04em] text-white lg:text-[28px]">
        {currentTrack?.title || 'Nenhuma faixa'}
      </div>

      {currentTrack?.subtitle ? (
        <div className="mt-2 break-words text-[13px] font-semibold uppercase tracking-[0.08em] text-fuchsia-200/70">
          {currentTrack.subtitle}
        </div>
      ) : null}

      {currentTrack?.notes ? (
        <div className="mt-4 rounded-[18px] border border-white/10 bg-black/10 px-4 py-4 text-[13px] leading-6 text-white/70">
          <span className="font-black text-white/85">Observação:</span> {currentTrack.notes}
        </div>
      ) : null}
    </div>
  );
}

function PlayerControls({ isPlaying, currentTrack, onPrev, onNext, onTogglePlay, desktop = false }) {
  const buttonClass = desktop
    ? 'min-w-0 rounded-[18px] border border-white/10 bg-white/10 px-4 py-4 text-[14px] font-black text-white'
    : `${CONTROL_BUTTON_CLASS} border border-white/10 bg-white/10`;

  return (
    <div className={desktop ? 'grid grid-cols-4 gap-3' : 'grid grid-cols-2 gap-3'}>
      <button type="button" onClick={onPrev} className={buttonClass}>
        Anterior
      </button>

      <button type="button" onClick={onTogglePlay} className={buttonClass}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>

      <button
        type="button"
        onClick={() => currentTrack?.url && window.open(currentTrack.url, '_blank', 'noopener,noreferrer')}
        disabled={!currentTrack?.url}
        className={
          desktop
            ? 'min-w-0 rounded-[18px] bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-4 text-[14px] font-black text-white disabled:opacity-50'
            : `${CONTROL_BUTTON_CLASS} bg-gradient-to-r from-violet-500 to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50`
        }
      >
        YouTube
      </button>

      <button type="button" onClick={onNext} className={buttonClass}>
        Próxima
      </button>
    </div>
  );
}

function TrackList({ playlist, currentIndex, onSelectTrack, desktop = false }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] font-black uppercase tracking-[0.08em] text-white/50">Faixas do repertório</div>
        <div className="shrink-0 text-[12px] font-semibold text-white/40">{playlist.length} faixa(s)</div>
      </div>

      <div className="mt-4 space-y-3 pb-2">
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
                className={`${desktop ? 'block w-full rounded-[22px] border px-4 py-4 text-left transition' : TRACK_BUTTON_BASE_CLASS} ${
                  active
                    ? 'border-fuchsia-300/20 bg-fuchsia-400/10 shadow-[0_12px_28px_rgba(217,70,239,0.12)]'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-black ${
                      active ? 'bg-fuchsia-500 text-white' : 'bg-white/10 text-white/80'
                    }`}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className={desktop ? 'truncate text-[15px] font-black text-white' : 'break-words text-[15px] font-black text-white'}>{track.title}</div>
                    {track.subtitle ? (
                      <div className={desktop ? 'mt-1 truncate text-[12px] font-semibold uppercase tracking-[0.08em] text-white/60' : 'mt-1 break-words text-[12px] font-semibold uppercase tracking-[0.08em] text-white/60'}>
                        {track.subtitle}
                      </div>
                    ) : null}
                    {track.notes ? <div className="mt-2 break-words text-[12px] leading-5 text-white/50">{track.notes}</div> : null}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

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

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyTouchAction = document.body.style.touchAction;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.touchAction = previousBodyTouchAction;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-[4px]">
      <div className="flex min-h-[100dvh] items-end justify-center pt-[env(safe-area-inset-top,0px)] lg:min-h-screen lg:items-center lg:p-6">
        <div className="flex h-[min(92dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)))] w-full min-h-0 flex-col overflow-hidden rounded-t-[30px] border border-white/10 bg-[#0b1020] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] lg:h-auto lg:max-h-[92vh] lg:max-w-5xl lg:rounded-[30px]">
          <div className="shrink-0 border-b border-white/10 px-5 py-4 lg:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-black uppercase tracking-[0.12em] text-fuchsia-200/70">
                  Playlist do repertório
                </div>
                <h3 className="mt-2 truncate text-[24px] font-black tracking-[-0.04em] text-white sm:text-[28px]">
                  {eventTitle || 'Repertório'}
                </h3>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar player"
                className="min-h-11 shrink-0 touch-manipulation rounded-[16px] border border-white/10 bg-white/10 px-4 py-3 text-[14px] font-black text-white transition active:scale-[0.98]"
              >
                Fechar
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-5 [-webkit-overflow-scrolling:touch] lg:hidden">
            <div className="flex min-w-0 flex-col gap-5">
              <PlayerStatusBadge isPlaying={isPlaying} />
              <NowPlayingCard currentTrack={currentTrack} />
              <YoutubePlaybackFrame videoId={videoId} title={currentTrack?.title} isPlaying={isPlaying} thumbnailUrl={thumbnailUrl} />
              <PlayerControls isPlaying={isPlaying} currentTrack={currentTrack} onPrev={onPrev} onNext={onNext} onTogglePlay={onTogglePlay} />
              <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/45">Como funciona</div>
                <div className="mt-2 text-[14px] leading-6 text-white/65">
                  O áudio agora usa o player visível do YouTube para funcionar melhor em iPhone e navegador interno do Instagram.
                </div>
              </div>
              <TrackList playlist={playlist} currentIndex={currentIndex} onSelectTrack={onSelectTrack} />
            </div>
          </div>

          <div className="hidden flex-1 min-h-0 min-w-0 overflow-hidden lg:grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="min-h-0 min-w-0 overflow-y-auto border-r border-white/10 p-6">
              <div className="flex min-h-0 flex-col gap-5">
                <PlayerStatusBadge isPlaying={isPlaying} />
                <NowPlayingCard currentTrack={currentTrack} />
                <YoutubePlaybackFrame videoId={videoId} title={currentTrack?.title} isPlaying={isPlaying} thumbnailUrl={thumbnailUrl} />
                <PlayerControls desktop isPlaying={isPlaying} currentTrack={currentTrack} onPrev={onPrev} onNext={onNext} onTogglePlay={onTogglePlay} />
                <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.08em] text-white/45">Como funciona</div>
                  <div className="mt-2 text-[14px] leading-6 text-white/65">
                    Player visível do YouTube com controles e fallback seguro para reprodução com som.
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 min-w-0 overflow-y-auto p-6">
              <TrackList desktop playlist={playlist} currentIndex={currentIndex} onSelectTrack={onSelectTrack} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
