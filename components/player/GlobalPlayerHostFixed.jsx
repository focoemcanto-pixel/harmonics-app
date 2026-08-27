'use client';

// HARMONICS_STABLE_HOST_V3
import { useCallback, useEffect, useRef, useState } from 'react';
import { useGlobalPlayer } from '@/components/player/GlobalPlayerProvider';

function ensureYouTubeAPI() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    if (window.YT?.Player) return resolve(window.YT);

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

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(interval);
        resolve(window.YT);
      } else if (Date.now() - startedAt > 10000) {
        window.clearInterval(interval);
        resolve(window.YT || null);
      }
    }, 120);
  });
}

function sameRect(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
}

function enableNativePipCapabilities(player) {
  try {
    const iframe = player?.getIframe?.();
    if (!iframe) return;
    iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('webkitallowfullscreen', '');
    iframe.setAttribute('allowpictureinpicture', '');
  } catch {
    // YouTube/iOS decide a disponibilidade final do PiP; não interromper o player.
  }
}

export default function GlobalPlayerHostFixed() {
  const {
    state: {
      videoId,
      playerRef,
      desiredPlaybackState,
      pendingManualPlay,
      currentTrack,
    },
    actions: {
      setPlayerRef,
      setIsPlaying,
      setCurrentTime,
      next,
      setPendingManualPlay,
      setHasUserUnlockedPlayback,
      setIsTrackTransitioning,
    },
  } = useGlobalPlayer();

  const mountNodeRef = useRef(null);
  const currentVideoIdRef = useRef('');
  const desiredRef = useRef(desiredPlaybackState);
  const pendingRef = useRef(pendingManualPlay);
  const initializingRef = useRef(false);
  const [visibleRect, setVisibleRect] = useState(null);

  useEffect(() => { desiredRef.current = desiredPlaybackState; }, [desiredPlaybackState]);
  useEffect(() => { pendingRef.current = pendingManualPlay; }, [pendingManualPlay]);

  const syncVisibleRect = useCallback(() => {
    if (typeof document === 'undefined') return;
    const target = document.getElementById('harmonics-visible-player-host');
    if (!target) {
      setVisibleRect((previous) => previous ? null : previous);
      return;
    }
    const rect = target.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) {
      setVisibleRect((previous) => previous ? null : previous);
      return;
    }
    const nextRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    setVisibleRect((previous) => sameRect(previous, nextRect) ? previous : nextRect);
  }, []);

  useEffect(() => {
    syncVisibleRect();
    const onLayout = () => window.requestAnimationFrame(syncVisibleRect);
    window.addEventListener('resize', onLayout, { passive: true });
    window.addEventListener('orientationchange', onLayout, { passive: true });
    window.addEventListener('scroll', onLayout, { passive: true, capture: true });

    const observer = new MutationObserver(onLayout);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

    return () => {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('orientationchange', onLayout);
      window.removeEventListener('scroll', onLayout, true);
      observer.disconnect();
    };
  }, [syncVisibleRect]);

  useEffect(() => {
    let cancelled = false;

    async function initPlayer() {
      if (playerRef || initializingRef.current || !visibleRect || !videoId || !mountNodeRef.current) return;
      initializingRef.current = true;
      const YT = await ensureYouTubeAPI();
      if (cancelled || !YT?.Player || !mountNodeRef.current) {
        initializingRef.current = false;
        return;
      }

      const old = window.__harmonicsGlobalPlayerInstance;
      if (old) {
        try { old.destroy?.(); } catch {}
        window.__harmonicsGlobalPlayerInstance = null;
      }

      const instance = new YT.Player(mountNodeRef.current, {
        width: String(Math.max(220, Math.round(visibleRect.width))),
        height: String(Math.max(124, Math.round(visibleRect.height))),
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          fs: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            const target = event?.target || null;
            initializingRef.current = false;
            if (!target) return;
            enableNativePipCapabilities(target);
            setPlayerRef(target);
            window.__harmonicsGlobalPlayerInstance = target;
            currentVideoIdRef.current = videoId;

            if (desiredRef.current === 'playing' || pendingRef.current) {
              target.loadVideoById?.(videoId);
              target.playVideo?.();
            } else {
              target.cueVideoById?.(videoId);
            }
          },
          onStateChange: (event) => {
            const state = event?.data;
            const target = event?.target;

            if (state === window.YT?.PlayerState?.PLAYING) {
              enableNativePipCapabilities(target);
              setIsTrackTransitioning(false);
              setHasUserUnlockedPlayback(true);
              setPendingManualPlay(false);
              setIsPlaying(true);
              return;
            }

            if (state === window.YT?.PlayerState?.PAUSED) {
              setIsTrackTransitioning(false);
              setIsPlaying(false);
              return;
            }

            if (state === window.YT?.PlayerState?.CUED) {
              setIsTrackTransitioning(false);
              setIsPlaying(false);
              if (desiredRef.current === 'playing' || pendingRef.current) {
                target?.playVideo?.();
              }
              return;
            }

            if (state === window.YT?.PlayerState?.ENDED) {
              next({ reason: 'track_ended', forcePlay: true });
            }
          },
          onError: (event) => {
            console.warn('[PLAYER][YOUTUBE_ERROR]', {
              code: event?.data,
              videoId: currentVideoIdRef.current,
              title: currentTrack?.title || '',
            });
            setIsPlaying(false);
            setIsTrackTransitioning(false);
          },
        },
      });

      window.__harmonicsGlobalPlayerInstance = instance;
    }

    initPlayer();
    return () => { cancelled = true; };
  }, [playerRef, visibleRect, videoId, setPlayerRef, setIsPlaying, setPendingManualPlay, setHasUserUnlockedPlayback, setIsTrackTransitioning, next, currentTrack?.title]);

  useEffect(() => {
    if (!playerRef || !videoId) return;

    if (currentVideoIdRef.current !== videoId) {
      currentVideoIdRef.current = videoId;
      setIsTrackTransitioning(true);
      if (desiredPlaybackState === 'playing') {
        playerRef.loadVideoById?.(videoId);
        playerRef.playVideo?.();
      } else {
        playerRef.cueVideoById?.(videoId);
        setIsPlaying(false);
        setIsTrackTransitioning(false);
      }
      return;
    }

    if (desiredPlaybackState === 'playing') {
      const state = playerRef.getPlayerState?.();
      if (state !== window.YT?.PlayerState?.PLAYING && state !== window.YT?.PlayerState?.BUFFERING) {
        playerRef.playVideo?.();
      }
    } else {
      const state = playerRef.getPlayerState?.();
      if (state === window.YT?.PlayerState?.PLAYING || state === window.YT?.PlayerState?.BUFFERING) {
        playerRef.pauseVideo?.();
      }
    }
  }, [videoId, playerRef, desiredPlaybackState, setIsPlaying, setIsTrackTransitioning]);

  useEffect(() => {
    if (!playerRef || desiredPlaybackState !== 'playing') return undefined;
    const timer = window.setInterval(() => {
      const nextTime = Number(playerRef.getCurrentTime?.() || 0);
      if (Number.isFinite(nextTime)) setCurrentTime(nextTime);
    }, 750);
    return () => window.clearInterval(timer);
  }, [playerRef, desiredPlaybackState, setCurrentTime]);

  return (
    <div
      aria-hidden={visibleRect ? undefined : 'true'}
      style={{
        position: 'fixed',
        left: visibleRect ? visibleRect.left : -10000,
        top: visibleRect ? visibleRect.top : 0,
        width: visibleRect ? visibleRect.width : 220,
        height: visibleRect ? visibleRect.height : 124,
        opacity: visibleRect ? 1 : 0.01,
        pointerEvents: visibleRect ? 'auto' : 'none',
        overflow: 'hidden',
        zIndex: visibleRect ? 190 : 0,
        borderRadius: visibleRect ? 18 : 0,
        background: '#000',
      }}
    >
      <div ref={mountNodeRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
