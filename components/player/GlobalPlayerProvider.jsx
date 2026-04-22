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
  const [renderTarget, setRenderTarget] = useState(null);
  const [renderTargetName, setRenderTargetName] = useState('hidden_fallback');

  const currentTrack = playlist[currentTrackIndex] || null;
  const videoId = String(currentTrack?.videoId || '').trim() || extractYoutubeId(currentTrack?.url || '');

  const setTrack = useCallback((index) => {
    setCurrentTrackIndex((prev) => {
      if (!Array.isArray(playlist) || playlist.length === 0) return 0;
      if (!Number.isFinite(index)) return prev;
      const safeIndex = Math.max(0, Math.min(Number(index), playlist.length - 1));
      return safeIndex;
    });
  }, [playlist]);

  const next = useCallback(() => {
    setCurrentTrackIndex((prev) => {
      if (!playlist.length) return 0;
      return (prev + 1) % playlist.length;
    });
  }, [playlist.length]);

  const prev = useCallback(() => {
    setCurrentTrackIndex((prevIndex) => {
      if (!playlist.length) return 0;
      return (prevIndex - 1 + playlist.length) % playlist.length;
    });
  }, [playlist.length]);

  const play = useCallback(() => {
    setIsPlaying(true);
    playerRef?.playVideo?.();
  }, [playerRef]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    playerRef?.pauseVideo?.();
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

    if (options.autoplay === false) {
      setIsPlaying(false);
      return;
    }

    setIsPlaying(normalizedPlaylist.length > 0);
  }, []);

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
    renderTarget,
    renderTargetName,
    currentTrack,
  }), [isPlaying, currentTrackIndex, currentTime, videoId, playlist, volume, playerRef, renderTarget, renderTargetName, currentTrack]);

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
    setRenderTarget: (target, targetName = 'unknown') => {
      setRenderTarget(target || null);
      setRenderTargetName(target ? targetName : 'hidden_fallback');
    },
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
