'use client';

import { useEffect, useRef } from 'react';
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
    state: { videoId, isPlaying, playerRef, currentTrackIndex, currentTrack },
    actions: { setPlayerRef, setIsPlaying, setCurrentTime, next },
  } = useGlobalPlayer();

  const mountNodeRef = useRef(null);
  const currentVideoIdRef = useRef('');
  const createdInstancesRef = useRef(0);
  const pendingTrackChangeRef = useRef(false);
  const shouldResumeAfterTrackChangeRef = useRef(false);
  const previousTrackSnapshotRef = useRef({ index: 0, videoId: '' });

  useEffect(() => {
    console.log('[PLAYER_MOUNT]', 'GlobalPlayerHost mounted');
    return () => {
      console.log('[PLAYER_UNMOUNT]', 'GlobalPlayerHost unmounted');
      playerRef?.destroy?.();
      if (typeof window !== 'undefined') {
        window.__harmonicsGlobalPlayerInstance = null;
      }
    };
  }, [playerRef]);

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
    if (!videoId) return;

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
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: (event) => {
              currentVideoIdRef.current = videoId;
              console.log('[AUDIO_PLAYER][GLOBAL_INSTANCE]', event?.target || null);
              createdInstancesRef.current += 1;
              console.log('[AUDIO_PLAYER][GLOBAL_INSTANCE]', { instanceCount: createdInstancesRef.current });
              setPlayerRef(event?.target || null);
              window.__harmonicsGlobalPlayerInstance = event?.target || null;
              if (isPlaying) {
                event?.target?.playVideo?.();
              }
            },
            onStateChange: (event) => {
              const state = event?.data;
              if (state === window.YT.PlayerState.PLAYING) {
                pendingTrackChangeRef.current = false;
                shouldResumeAfterTrackChangeRef.current = false;
                setIsPlaying(true);
                console.log('[AUDIO_PLAYER][IS_PLAYING]', true);
                console.log('[PLAYER][IS_PLAYING_AFTER_CHANGE]', {
                  isPlaying: true,
                  reason: 'onStateChange:PLAYING',
                });
              }
              if (state === window.YT.PlayerState.PAUSED) {
                if (pendingTrackChangeRef.current && shouldResumeAfterTrackChangeRef.current) {
                  console.log('[PLAYER][IS_PLAYING_AFTER_CHANGE]', {
                    isPlaying: true,
                    ignoredPauseEvent: true,
                    reason: 'track_change_while_should_continue_playing',
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
                pendingTrackChangeRef.current = false;
                shouldResumeAfterTrackChangeRef.current = false;
              }
              if (state === window.YT.PlayerState.ENDED) {
                console.log('[PLAYER][TRACK_ENDED]', {
                  index: currentTrackIndex,
                  title: currentTrack?.title || '',
                });
                console.log('[PLAYER][AUTO_ADVANCE]', {
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
        return;
      }

      if (currentVideoIdRef.current !== videoId) {
        const shouldContinuePlaying = isPlaying;
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

        if (isPlaying) {
          playerRef.loadVideoById?.(videoId);
        } else {
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

      if (isPlaying) {
        playerRef.playVideo?.();
      } else {
        playerRef.pauseVideo?.();
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [videoId, isPlaying, playerRef, setIsPlaying, setPlayerRef, next, currentTrack?.title, currentTrackIndex]);

  useEffect(() => {
    console.log('[AUDIO_PLAYER][GLOBAL_INSTANCE]', {
      videoId,
      isPlaying,
      currentTrackIndex,
      hasInstance: Boolean(playerRef),
    });
    console.log('[AUDIO_PLAYER][CURRENT_TRACK]', {
      title: currentTrack?.title || '',
      index: currentTrackIndex,
      videoId,
    });
    previousTrackSnapshotRef.current = { index: currentTrackIndex, videoId };
  }, [videoId, isPlaying, currentTrackIndex, playerRef, currentTrack]);

  return (
    <div className="hidden" aria-hidden="true">
      <div ref={mountNodeRef} />
    </div>
  );
}
