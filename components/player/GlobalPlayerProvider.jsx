'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { extractYoutubeId } from '@/lib/membro/membro-invites';

const GlobalPlayerContext = createContext(null);

export function GlobalPlayerProvider({ children }) {
  const [playlist, setPlaylist] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(100);
  const [playerRef, setPlayerRef] = useState(null);

  const currentTrack = playlist[currentTrackIndex] || null;
  const videoId = String(currentTrack?.videoId || '').trim() || extractYoutubeId(currentTrack?.url || '');

  const schedulePlayVideo = useCallback(() => {
    setTimeout(() => {
      playerRef?.playVideo?.();
    }, 0);
  }, [playerRef]);

  const setTrack = useCallback((index, options = {}) => {
    const shouldContinuePlaying = options.forcePlay === true ? true : isPlaying;
    console.log('[PLAYER][TRACK_BEFORE_CHANGE]', {
      source: 'setTrack',
      isPlaying,
      currentTrackIndex,
      requestedIndex: index,
      shouldContinuePlaying,
      reason: options.reason || 'manual_select',
    });

    setCurrentTrackIndex((prev) => {
      if (!Array.isArray(playlist) || playlist.length === 0) return 0;
      if (!Number.isFinite(index)) return prev;
      const safeIndex = Math.max(0, Math.min(Number(index), playlist.length - 1));
      console.log('[PLAYER][TRACK_AFTER_CHANGE]', {
        source: 'setTrack',
        previousIndex: prev,
        nextIndex: safeIndex,
      });
      return safeIndex;
    });

    if (shouldContinuePlaying) {
      setIsPlaying(true);
      schedulePlayVideo();
    }
  }, [playlist, isPlaying, currentTrackIndex, schedulePlayVideo]);

  const next = useCallback((options = {}) => {
    const shouldContinuePlaying = options.forcePlay === true ? true : isPlaying;
    console.log('[PLAYER][NEXT_CLICK]', {
      isPlaying,
      currentTrackIndex,
      shouldContinuePlaying,
      reason: options.reason || 'manual',
    });

    setCurrentTrackIndex((prev) => {
      if (!playlist.length) return 0;
      const nextIndex = (prev + 1) % playlist.length;
      console.log('[PLAYER][TRACK_AFTER_CHANGE]', {
        source: 'next',
        previousIndex: prev,
        nextIndex,
      });
      return nextIndex;
    });

    if (shouldContinuePlaying) {
      setIsPlaying(true);
      schedulePlayVideo();
    }
  }, [playlist.length, isPlaying, currentTrackIndex, schedulePlayVideo]);

  const prev = useCallback((options = {}) => {
    const shouldContinuePlaying = options.forcePlay === true ? true : isPlaying;
    console.log('[PLAYER][PREV_CLICK]', {
      isPlaying,
      currentTrackIndex,
      shouldContinuePlaying,
      reason: options.reason || 'manual',
    });

    setCurrentTrackIndex((prevIndex) => {
      if (!playlist.length) return 0;
      const nextIndex = (prevIndex - 1 + playlist.length) % playlist.length;
      console.log('[PLAYER][TRACK_AFTER_CHANGE]', {
        source: 'prev',
        previousIndex: prevIndex,
        nextIndex,
      });
      return nextIndex;
    });

    if (shouldContinuePlaying) {
      setIsPlaying(true);
      schedulePlayVideo();
    }
  }, [playlist.length, isPlaying, currentTrackIndex, schedulePlayVideo]);

  const play = useCallback(() => {
    playerRef?.playVideo?.();
    console.log('[AUDIO_PLAYER][PLAY_REQUESTED]', { hasPlayer: Boolean(playerRef) });
  }, [playerRef]);

  const pause = useCallback(() => {
    playerRef?.pauseVideo?.();
    console.log('[AUDIO_PLAYER][PAUSE_REQUESTED]', { hasPlayer: Boolean(playerRef) });
  }, [playerRef]);

  const seek = useCallback((timeInSeconds) => {
    const safeTime = Math.max(0, Number(timeInSeconds) || 0);
    setCurrentTime(safeTime);
    playerRef?.seekTo?.(safeTime, true);
  }, [playerRef]);

  const replacePlaylist = useCallback((nextPlaylist = [], options = {}) => {
    const normalizedPlaylist = Array.isArray(nextPlaylist) ? nextPlaylist : [];
    const nextIndex = Number.isFinite(options.startIndex)
      ? Math.max(0, Math.min(Number(options.startIndex), Math.max(normalizedPlaylist.length - 1, 0)))
      : 0;

    setPlaylist(normalizedPlaylist);
    setCurrentTrackIndex(nextIndex);
    setCurrentTime(0);
    console.log('[AUDIO_PLAYER][GLOBAL_INSTANCE]', {
      playlistSize: normalizedPlaylist.length,
      startIndex: nextIndex,
    });

    const shouldAutoPlay = options.autoplay === true && normalizedPlaylist.length > 0;

    if (!shouldAutoPlay) {
      setIsPlaying(false);
      console.log('[AUDIO_PLAYER][IS_PLAYING]', false);
      playerRef?.pauseVideo?.();

      const initialTrack = normalizedPlaylist[nextIndex] || null;
      const initialVideoId = String(initialTrack?.videoId || '').trim() || extractYoutubeId(initialTrack?.url || '');
      if (initialVideoId) {
        playerRef?.cueVideoById?.(initialVideoId);
      }
      return;
    }

    setIsPlaying(true);
    console.log('[AUDIO_PLAYER][IS_PLAYING]', true);
    schedulePlayVideo();
  }, [playerRef, schedulePlayVideo]);

  const closeSession = useCallback(() => {
    setPlaylist([]);
    setCurrentTrackIndex(0);
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const state = useMemo(() => ({
    isPlaying,
    currentTrackIndex,
    currentTime,
    videoId,
    playlist,
    volume,
    playerRef,
    currentTrack,
  }), [isPlaying, currentTrackIndex, currentTime, videoId, playlist, volume, playerRef, currentTrack]);

  const actions = useMemo(() => ({
    play,
    pause,
    next,
    prev,
    seek,
    setTrack,
    setVolume,
    setCurrentTime,
    setPlayerRef,
    setIsPlaying,
    replacePlaylist,
    closeSession,
  }), [play, pause, next, prev, seek, setTrack, replacePlaylist, closeSession]);

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <GlobalPlayerContext.Provider value={value}>{children}</GlobalPlayerContext.Provider>;
}

export function useGlobalPlayer() {
  const context = useContext(GlobalPlayerContext);
  if (!context) {
    throw new Error('useGlobalPlayer deve ser usado dentro de <GlobalPlayerProvider />');
  }
  return context;
}
