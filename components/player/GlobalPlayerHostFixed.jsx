'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useGlobalPlayer } from '@/components/player/GlobalPlayerProvider';

function ensureYouTubeAPI() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);

    if (window.YT?.Player) {
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

    const interval = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(interval);
        resolve(window.YT);
      }
    }, 120);

    window.setTimeout(() => {
      window.clearInterval(interval);
      resolve(window.YT || null);
    }, 10000);
  });
}

export default function GlobalPlayerHostFixed() {
  const {
    state: {
      videoId,
      playerRef,
      currentTrackIndex,
      currentTrack,
      desiredPlaybackState,
      pendingManualPlay,
      isTrackTransitioning,
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
  const retryTimeoutsRef = useRef([]);

  const clearRetries = useCallback(() => {
    retryTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    retryTimeoutsRef.current = [];
  }, []);

  const isActuallyPlaying = useCallback((targetPlayer) => {
    if (!targetPlayer || typeof window === 'undefined') return false;
    return targetPlayer.getPlayerState?.() === window.YT?.PlayerState?.PLAYING;
  }, []);

  const retryPlay = useCallback((targetPlayer, reason = 'retry') => {
    if (!targetPlayer) return;
    clearRetries();

    [0, 120, 300, 700, 1200].forEach((delay, attempt) => {
      const id = window.setTimeout(() => {
        if (desiredPlaybackState !== 'playing') return;
        if (isActuallyPlaying(targetPlayer)) {
          clearRetries();
          return;
        }

        console.log('[PLAYER][PLAY_RETRY_VISIBLE_HOST]', { reason, delay, attempt });
        targetPlayer.playVideo?.();
      }, delay);

      retryTimeoutsRef.current.push(id);
    });
  }, [clearRetries, desiredPlaybackState, isActuallyPlaying]);

  const loadAndPlay = useCallback((targetPlayer, nextVideoId, reason = 'load_and_play') => {
    if (!targetPlayer || !nextVideoId) return;
    currentVideoIdRef.current = nextVideoId;
    setIsTrackTransitioning(true);
    targetPlayer.loadVideoById?.(nextVideoId);
    targetPlayer.playVideo?.();
    retryPlay(targetPlayer, reason);
  }, [retryPlay, setIsTrackTransitioning]);

  useEffect(() => {
    let cancelled = false;

    async function initPlayer() {
      const YT = await ensureYouTubeAPI();
      if (!YT?.Player || cancelled || !mountNodeRef.current || playerRef) return;

      const existing = window.__harmonicsGlobalPlayerInstance;
      if (existing) {
        try {
          existing.stopVideo?.();
          existing.destroy?.();
        } catch {
          // no-op
        }
        window.__harmonicsGlobalPlayerInstance = null;
      }

      const instance = new YT.Player(mountNodeRef.current, {
        width: '220',
        height: '124',
        videoId: videoId || undefined,
        playerVars: {
          autoplay: 0,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            const target = event?.target || null;
            setPlayerRef(target);
            window.__harmonicsGlobalPlayerInstance = target;

            if (!target || !videoId) return;
            currentVideoIdRef.current = videoId;

            if (desiredPlaybackState === 'playing' || pendingManualPlay) {
              loadAndPlay(target, videoId, pendingManualPlay ? 'ready_pending_manual' : 'ready_desired_playing');
            } else {
              target.cueVideoById?.(videoId);
            }
          },
          onStateChange: (event) => {
            const state = event?.data;
            const target = event?.target;

            if (state === window.YT.PlayerState.PLAYING) {
              clearRetries();
              setIsTrackTransitioning(false);
              setHasUserUnlockedPlayback(true);
              setPendingManualPlay(false);
              setIsPlaying(true);
              console.log('[AUDIO_PLAYER][IS_PLAYING]', true);
              return;
            }

            if (state === window.YT.PlayerState.PAUSED) {
              if (desiredPlaybackState === 'playing' || pendingManualPlay || isTrackTransitioning) {
                retryPlay(target, 'paused_while_desired_playing');
                setIsPlaying(true);
                return;
              }

              setIsPlaying(false);
              console.log('[AUDIO_PLAYER][IS_PLAYING]', false);
              return;
            }

            if (state === window.YT.PlayerState.CUED) {
              if (desiredPlaybackState === 'playing' || pendingManualPlay || isTrackTransitioning) {
                target?.playVideo?.();
                retryPlay(target, 'cued_while_desired_playing');
                setIsPlaying(true);
                return;
              }

              setIsPlaying(false);
              return;
            }

            if (state === window.YT.PlayerState.ENDED) {
              next({ reason: 'track_ended', forcePlay: true });
            }
          },
          onError: (event) => {
            console.warn('[PLAYER][YOUTUBE_ERROR]', {
              code: event?.data,
              videoId,
              title: currentTrack?.title || '',
            });
            setIsPlaying(false);
            setIsTrackTransitioning(false);
          },
        },
      });

      setPlayerRef(instance);
      window.__harmonicsGlobalPlayerInstance = instance;
    }

    initPlayer();

    return () => {
      cancelled = true;
    };
  }, [
    playerRef,
    setPlayerRef,
    setIsPlaying,
    setPendingManualPlay,
    setHasUserUnlockedPlayback,
    setIsTrackTransitioning,
    next,
    videoId,
    desiredPlaybackState,
    pendingManualPlay,
    isTrackTransitioning,
    currentTrack?.title,
    clearRetries,
    loadAndPlay,
    retryPlay,
  ]);

  useEffect(() => {
    if (!playerRef) return;

    if (!videoId) {
      clearRetries();
      playerRef.stopVideo?.();
      currentVideoIdRef.current = '';
      setIsPlaying(false);
      setIsTrackTransitioning(false);
      return;
    }

    if (currentVideoIdRef.current !== videoId) {
      if (desiredPlaybackState === 'playing') {
        loadAndPlay(playerRef, videoId, 'video_id_changed');
      } else {
        clearRetries();
        currentVideoIdRef.current = videoId;
        playerRef.cueVideoById?.(videoId);
        setIsPlaying(false);
        setIsTrackTransitioning(false);
      }
      return;
    }

    if (desiredPlaybackState === 'playing') {
      playerRef.playVideo?.();
      retryPlay(playerRef, pendingManualPlay ? 'pending_manual_effect' : 'desired_playing_effect');
      setIsPlaying(true);
    } else {
      clearRetries();
      playerRef.pauseVideo?.();
      setIsPlaying(false);
      setIsTrackTransitioning(false);
    }
  }, [
    videoId,
    playerRef,
    currentTrackIndex,
    desiredPlaybackState,
    pendingManualPlay,
    clearRetries,
    loadAndPlay,
    retryPlay,
    setIsPlaying,
    setIsTrackTransitioning,
  ]);

  useEffect(() => {
    if (!playerRef || desiredPlaybackState !== 'playing') return undefined;

    const timer = window.setInterval(() => {
      setCurrentTime(playerRef.getCurrentTime?.() || 0);
    }, 500);

    return () => window.clearInterval(timer);
  }, [playerRef, desiredPlaybackState, setCurrentTime]);

  useEffect(() => () => {
    clearRetries();
  }, [clearRetries]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        bottom: 0,
        width: 220,
        height: 124,
        opacity: 0.01,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      <div ref={mountNodeRef} />
    </div>
  );
}
