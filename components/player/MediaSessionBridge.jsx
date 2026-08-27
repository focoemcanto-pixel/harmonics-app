'use client';

import { useEffect } from 'react';
import { useGlobalPlayer } from '@/components/player/GlobalPlayerProvider';

const ACTIONS = [
  'play',
  'pause',
  'previoustrack',
  'nexttrack',
  'seekbackward',
  'seekforward',
  'seekto',
];

function safeSetActionHandler(mediaSession, action, handler) {
  try {
    mediaSession.setActionHandler(action, handler);
  } catch {
    // Alguns navegadores/iOS expõem Media Session parcialmente.
  }
}

function resolveArtwork(videoId) {
  if (!videoId) return [];
  return [
    { src: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`, sizes: '1280x720', type: 'image/jpeg' },
    { src: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' },
  ];
}

export default function MediaSessionBridge() {
  const {
    state: {
      currentTrack,
      currentTrackIndex,
      playlist,
      isPlaying,
      currentTime,
      videoId,
    },
    actions: {
      play,
      pause,
      next,
      prev,
      seek,
    },
  } = useGlobalPlayer();

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return undefined;

    const mediaSession = navigator.mediaSession;
    if (!currentTrack) {
      try { mediaSession.metadata = null; } catch {}
      try { mediaSession.playbackState = 'none'; } catch {}
      return undefined;
    }

    try {
      mediaSession.metadata = new MediaMetadata({
        title: String(currentTrack?.title || 'Repertório Harmonics'),
        artist: String(currentTrack?.subtitle || 'Harmonics'),
        album: `Harmonics • ${currentTrackIndex + 1} de ${playlist.length || 1}`,
        artwork: resolveArtwork(videoId),
      });
    } catch (error) {
      console.warn('[MEDIA_SESSION][METADATA_UNAVAILABLE]', error);
    }

    try {
      mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch {}

    safeSetActionHandler(mediaSession, 'play', () => play());
    safeSetActionHandler(mediaSession, 'pause', () => pause());
    safeSetActionHandler(mediaSession, 'previoustrack', () => prev({ reason: 'media_session_previous', forcePlay: isPlaying }));
    safeSetActionHandler(mediaSession, 'nexttrack', () => next({ reason: 'media_session_next', forcePlay: isPlaying }));
    safeSetActionHandler(mediaSession, 'seekbackward', (details) => {
      const offset = Number(details?.seekOffset || 10);
      seek(Math.max(0, Number(currentTime || 0) - offset));
    });
    safeSetActionHandler(mediaSession, 'seekforward', (details) => {
      const offset = Number(details?.seekOffset || 10);
      seek(Math.max(0, Number(currentTime || 0) + offset));
    });
    safeSetActionHandler(mediaSession, 'seekto', (details) => {
      if (Number.isFinite(details?.seekTime)) seek(details.seekTime);
    });

    return () => {
      ACTIONS.forEach((action) => safeSetActionHandler(mediaSession, action, null));
    };
  }, [
    currentTrack,
    currentTrackIndex,
    playlist.length,
    isPlaying,
    currentTime,
    videoId,
    play,
    pause,
    next,
    prev,
    seek,
  ]);

  return null;
}
