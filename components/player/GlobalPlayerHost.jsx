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
    state: { videoId, isPlaying, playerRef, currentTrackIndex, renderTarget, renderTargetName, currentTrack },
    actions: { setPlayerRef, setIsPlaying, setCurrentTime, next },
  } = useGlobalPlayer();

  const fallbackHostRef = useRef(null);
  const mountNodeRef = useRef(null);
  const currentVideoIdRef = useRef('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!mountNodeRef.current) {
      const node = document.createElement('div');
      node.setAttribute('data-global-player-mount', 'true');
      mountNodeRef.current = node;
    }
    const node = mountNodeRef.current;

    if (fallbackHostRef.current) {
      fallbackHostRef.current.appendChild(node);
    }

    return () => {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
      mountNodeRef.current = null;
    };
  }, []);

  useEffect(() => {
    console.log('[PLAYER_MOUNT]', 'GlobalPlayerHost mounted');
    return () => {
      console.log('[PLAYER_UNMOUNT]', 'GlobalPlayerHost unmounted');
      playerRef?.destroy?.();
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
              console.log('[PLAYER_INSTANCE]', event?.target || null);
              setPlayerRef(event?.target || null);
              if (isPlaying) {
                event?.target?.playVideo?.();
              }
            },
            onStateChange: (event) => {
              const state = event?.data;
              if (state === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
              }
              if (state === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
              }
              if (state === window.YT.PlayerState.ENDED) {
                next();
              }
            },
          },
        });

        setPlayerRef(instance);
        return;
      }

      if (currentVideoIdRef.current !== videoId) {
        currentVideoIdRef.current = videoId;
        if (isPlaying) {
          playerRef.loadVideoById?.(videoId);
        } else {
          playerRef.cueVideoById?.(videoId);
        }
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
  }, [videoId, isPlaying, playerRef, setIsPlaying, setPlayerRef, next]);

  useEffect(() => {
    console.log('[GLOBAL_PLAYER][INSTANCE]', {
      videoId,
      isPlaying,
      currentTrackIndex,
      hasInstance: Boolean(playerRef),
    });
    console.log('[GLOBAL_PLAYER][TRACK_STATE]', {
      title: currentTrack?.title || '',
      index: currentTrackIndex,
      videoId,
    });
  }, [videoId, isPlaying, currentTrackIndex, playerRef, currentTrack]);

  useEffect(() => {
    const target = renderTarget || fallbackHostRef.current;
    if (!target || !mountNodeRef.current) return;
    target.appendChild(mountNodeRef.current);
    console.log('[GLOBAL_PLAYER][HOST_CONTAINER]', {
      target: renderTargetName,
      usingFallback: !renderTarget,
    });
    console.log('[GLOBAL_PLAYER][RENDER_TARGET]', renderTargetName);
  }, [renderTarget, renderTargetName]);

  return (
    <div className="hidden" aria-hidden="true">
      <div ref={fallbackHostRef} />
    </div>
  );
}
