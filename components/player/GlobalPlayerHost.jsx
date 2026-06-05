'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useGlobalPlayer } from '@/components/player/GlobalPlayerProvider';

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

export default function GlobalPlayerHost() {
  const {
    state: {
      videoId,
      isPlaying,
      playerRef,
      currentTrackIndex,
      currentTrack,
      desiredPlaybackState,
      pendingManualPlay,
      hasUserUnlockedPlayback,
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
  const createdInstancesRef = useRef(0);
  const pendingTrackChangeRef = useRef(false);
  const shouldResumeAfterTrackChangeRef = useRef(false);
  const previousTrackSnapshotRef = useRef({ index: 0, videoId: '' });
  const playRetryTimeoutsRef = useRef([]);

  const clearPlayRetries = useCallback(() => {
    playRetryTimeoutsRef.current.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    playRetryTimeoutsRef.current = [];
  }, []);

  const isPlayerPlaying = useCallback((targetPlayer) => {
    const playerState = targetPlayer?.getPlayerState?.();
    const playingState = typeof window !== 'undefined' ? window?.YT?.PlayerState?.PLAYING : null;
    return playerState === playingState;
  }, []);

  const schedulePlayRetries = useCallback((targetPlayer, reason) => {
    if (!targetPlayer) return;
    clearPlayRetries();
    [0, 80, 180, 360, 700].forEach((delay, attempt) => {
      const timeoutId = setTimeout(() => {
        if (desiredPlaybackState !== 'playing') return;
        if (isPlayerPlaying(targetPlayer)) {
          clearPlayRetries();
          return;
        }
        console.log('[PLAYER_MOBILE][PLAY_RETRY]', { reason, delay, attempt });
        targetPlayer?.playVideo?.();
      }, delay);
      playRetryTimeoutsRef.current.push(timeoutId);
    });
  }, [clearPlayRetries, desiredPlaybackState, isPlayerPlaying]);

  const forcePlay = useCallback((targetPlayer, reason) => {
    if (!targetPlayer) return;
    targetPlayer?.playVideo?.();
    schedulePlayRetries(targetPlayer, reason);
  }, [schedulePlayRetries]);

  const loadAndPlayVideo = useCallback((targetPlayer, nextVideoId, reason) => {
    if (!targetPlayer || !nextVideoId) return;

    clearPlayRetries();
    targetPlayer?.loadVideoById?.(nextVideoId);
    targetPlayer?.playVideo?.();
    schedulePlayRetries(targetPlayer, reason);
  }, [clearPlayRetries, schedulePlayRetries]);

  const requestPlayIfDesired = useCallback((targetPlayer, reason) => {
    if (!targetPlayer) return;
    if (desiredPlaybackState !== 'playing') return;
    if (isPlayerPlaying(targetPlayer)) {
      setPendingManualPlay(false);
      return;
    }
    forcePlay(targetPlayer, reason);
  }, [desiredPlaybackState, setPendingManualPlay, isPlayerPlaying, forcePlay]);

  useEffect(() => {
    console.log('[PLAYER_MOUNT]', 'GlobalPlayerHost mounted');
    return () => {
      console.log('[PLAYER_UNMOUNT]', 'GlobalPlayerHost unmounted');
      clearPlayRetries();
      playerRef?.destroy?.();
      if (typeof window !== 'undefined') {
        window.__harmonicsGlobalPlayerInstance = null;
      }
    };
  }, [playerRef, clearPlayRetries]);

  useEffect(() => {
    let timer = null;

    if (playerRef && isPlaying) {
      timer = setInterval(() => {
        const time = playerRef?.getCurrentTime?.() || 0;
        setCurrentTime(time);
      }, 500);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [playerRef, isPlaying, setCurrentTime]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const YT = await ensureYouTubeAPI();
      if (!YT || cancelled || !mountNodeRef.current) return;

      if (!playerRef) {
        const existingInstance = window.__harmonicsGlobalPlayerInstance;
        if (existingInstance && existingInstance !== playerRef) {
          existingInstance?.stopVideo?.();
          existingInstance?.destroy?.();
          window.__harmonicsGlobalPlayerInstance = null;
        }

        const instance = new YT.Player(mountNodeRef.current, {
          playerVars: {
            autoplay: 0,
            controls: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
          },
          events: {
            onReady: (event) => {
              currentVideoIdRef.current = '';
              console.log('[AUDIO_PLAYER][GLOBAL_INSTANCE]', event?.target || null);
              createdInstancesRef.current += 1;
              console.log('[AUDIO_PLAYER][GLOBAL_INSTANCE]', { instanceCount: createdInstancesRef.current });
              setPlayerRef(event?.target || null);
              window.__harmonicsGlobalPlayerInstance = event?.target || null;

              if (videoId) {
                currentVideoIdRef.current = videoId;
                if (desiredPlaybackState === 'playing' || pendingManualPlay) {
                  loadAndPlayVideo(
                    event?.target,
                    videoId,
                    pendingManualPlay ? 'on_ready_pending_manual' : 'on_ready_desired_playing'
                  );
                } else {
                  event?.target?.cueVideoById?.(videoId);
                }
              }
            },
            onStateChange: (event) => {
              const state = event?.data;
              if (state === window.YT.PlayerState.PLAYING) {
                pendingTrackChangeRef.current = false;
                shouldResumeAfterTrackChangeRef.current = false;
                setIsTrackTransitioning(false);
                if (!hasUserUnlockedPlayback) {
                  setHasUserUnlockedPlayback(true);
                }
                setPendingManualPlay(false);
                setIsPlaying(true);
                console.log('[AUDIO_PLAYER][IS_PLAYING]', true);
                console.log('[PLAYER][IS_PLAYING_AFTER_CHANGE]', {
                  isPlaying: true,
                  reason: 'onStateChange:PLAYING',
                });
              }
              if (state === window.YT.PlayerState.PAUSED) {
                if (desiredPlaybackState === 'playing' || isTrackTransitioning) {
                  console.log('[PLAYER][IS_PLAYING_AFTER_CHANGE]', {
                    isPlaying: true,
                    ignoredPauseEvent: true,
                    reason: 'transient_pause_during_track_transition',
                  });
                  return;
                }

                setIsPlaying(false);
                console.log('[AUDIO_PLAYER][IS_PLAYING]', false);
                console.log('[PLAYER][IS_PLAYING_AFTER_CHANGE]', {
                  isPlaying: false,
                  reason: 'onStateChange:PAUSED',
                });
              }
              if (state === window.YT.PlayerState.CUED) {
                if (desiredPlaybackState === 'playing' || pendingManualPlay || isTrackTransitioning) {
                  forcePlay(event?.target, pendingManualPlay ? 'cued_pending_manual' : 'cued_track_transition');
                  return;
                }

                pendingTrackChangeRef.current = false;
                shouldResumeAfterTrackChangeRef.current = false;
                setIsTrackTransitioning(false);
                setIsPlaying(false);
                console.log('[AUDIO_PLAYER][IS_PLAYING]', false);
                console.log('[PLAYER][IS_PLAYING_AFTER_CHANGE]', {
                  isPlaying: false,
                  reason: 'onStateChange:CUED',
                });
              }
              if (state === window.YT.PlayerState.ENDED) {
                console.log('[PLAYER][TRACK_ENDED]', {
                  index: currentTrackIndex,
                  title: currentTrack?.title || '',
                });
                console.log('[PLAYER_MOBILE][TRACK_ENDED]', {
                  index: currentTrackIndex,
                  title: currentTrack?.title || '',
                });
                console.log('[PLAYER][AUTO_ADVANCE]', {
                  fromIndex: currentTrackIndex,
                  fromTitle: currentTrack?.title || '',
                  toIndex: currentTrackIndex + 1,
                });
                console.log('[PLAYER_MOBILE][AUTO_ADVANCE]', {
                  fromIndex: currentTrackIndex,
                  fromTitle: currentTrack?.title || '',
                  toIndex: currentTrackIndex + 1,
                });
                next({ reason: 'track_ended', forcePlay: true });
              }
            },
          },
        });

        setPlayerRef(instance);
        window.__harmonicsGlobalPlayerInstance = instance;
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [
    playerRef,
    setPlayerRef,
    setIsPlaying,
    next,
    currentTrack?.title,
    currentTrackIndex,
    videoId,
    hasUserUnlockedPlayback,
    pendingManualPlay,
    isTrackTransitioning,
    setPendingManualPlay,
    setIsTrackTransitioning,
    setHasUserUnlockedPlayback,
    desiredPlaybackState,
    loadAndPlayVideo,
    forcePlay,
  ]);

  useEffect(() => {
    if (!playerRef) return;

    if (!videoId) {
      clearPlayRetries();
      playerRef.stopVideo?.();
      currentVideoIdRef.current = '';
      pendingTrackChangeRef.current = false;
      shouldResumeAfterTrackChangeRef.current = false;
      setIsTrackTransitioning(false);
      return;
    }

    if (currentVideoIdRef.current !== videoId) {
      const shouldContinuePlaying = desiredPlaybackState === 'playing';
      const previousTrack = previousTrackSnapshotRef.current;
      console.log('[PLAYER][TRACK_BEFORE_CHANGE]', {
        source: 'videoId_effect',
        previousTrackIndex: previousTrack.index,
        previousVideoId: previousTrack.videoId,
        isPlayingBeforeChange: shouldContinuePlaying,
      });

      currentVideoIdRef.current = videoId;
      pendingTrackChangeRef.current = true;
      shouldResumeAfterTrackChangeRef.current = shouldContinuePlaying;
      setIsTrackTransitioning(shouldContinuePlaying);

      if (shouldContinuePlaying) {
        loadAndPlayVideo(playerRef, videoId, 'video_change_while_playing');
      } else {
        clearPlayRetries();
        playerRef.cueVideoById?.(videoId);
      }

      console.log('[PLAYER][TRACK_AFTER_CHANGE]', {
        source: 'videoId_effect',
        currentTrackIndex,
        nextVideoId: videoId,
      });
      console.log('[PLAYER][IS_PLAYING_AFTER_CHANGE]', {
        isPlaying: shouldContinuePlaying,
        reason: 'post_video_change_intent',
      });

      previousTrackSnapshotRef.current = { index: currentTrackIndex, videoId };
      return;
    }

    if (desiredPlaybackState === 'playing') {
      requestPlayIfDesired(playerRef, pendingManualPlay ? 'is_playing_pending_manual' : 'is_playing_effect');
    } else {
      clearPlayRetries();
      playerRef.pauseVideo?.();
    }
  }, [
    videoId,
    isPlaying,
    playerRef,
    currentTrackIndex,
    clearPlayRetries,
    desiredPlaybackState,
    requestPlayIfDesired,
    pendingManualPlay,
    setIsTrackTransitioning,
    loadAndPlayVideo,
  ]);

  useEffect(() => {
    console.log('[AUDIO_PLAYER][GLOBAL_INSTANCE]', {
      videoId,
      isPlaying,
      desiredPlaybackState,
      pendingManualPlay,
      hasUserUnlockedPlayback,
      isTrackTransitioning,
      currentTrackIndex,
      hasInstance: Boolean(playerRef),
    });
    console.log('[AUDIO_PLAYER][CURRENT_TRACK]', {
      title: currentTrack?.title || '',
      index: currentTrackIndex,
      videoId,
    });
    previousTrackSnapshotRef.current = { index: currentTrackIndex, videoId };
  }, [
    videoId,
    isPlaying,
    desiredPlaybackState,
    pendingManualPlay,
    hasUserUnlockedPlayback,
    isTrackTransitioning,
    currentTrackIndex,
    playerRef,
    currentTrack,
  ]);

  return (
    <div className="hidden" aria-hidden="true">
      <div ref={mountNodeRef} />
    </div>
  );
}
