'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { extractYoutubeId } from '@/lib/membro/membro-invites';

const GlobalPlayerContext = createContext(null);

function resolveTrackVideoId(track = {}) {
  return String(track?.videoId || '').trim() || extractYoutubeId(track?.url || '');
}

export function GlobalPlayerProvider({ children }) {
  const [playlist, setPlaylist] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(100);
  const [playerRef, setPlayerRef] = useState(null);
  const [desiredPlaybackState, setDesiredPlaybackState] = useState('paused');
  const [pendingManualPlay, setPendingManualPlay] = useState(false);
  const [hasUserUnlockedPlayback, setHasUserUnlockedPlayback] = useState(false);
  const [isTrackTransitioning, setIsTrackTransitioning] = useState(false);

  const currentTrack = playlist[currentTrackIndex] || null;
  const videoId = resolveTrackVideoId(currentTrack);

  const schedulePlayVideo = useCallback(() => {
    window.setTimeout(() => playerRef?.playVideo?.(), 0);
    window.setTimeout(() => playerRef?.playVideo?.(), 160);
    window.setTimeout(() => playerRef?.playVideo?.(), 420);
  }, [playerRef]);

  const loadTrackForImmediatePlayback = useCallback((track) => {
    const nextVideoId = resolveTrackVideoId(track);
    if (!playerRef || !nextVideoId) return false;

    playerRef.loadVideoById?.(nextVideoId);
    return true;
  }, [playerRef]);

  const cueTrack = useCallback((track) => {
    const nextVideoId = resolveTrackVideoId(track);
    if (!playerRef || !nextVideoId) return false;

    playerRef.cueVideoById?.(nextVideoId);
    return true;
  }, [playerRef]);

  const shouldKeepPlaying = useCallback((options = {}) => {
    return options.forcePlay === true || isPlaying || desiredPlaybackState === 'playing';
  }, [isPlaying, desiredPlaybackState]);

  const requestPlaybackForTrack = useCallback((track, options = {}) => {
    const forceUserUnlock = options.manual === true || !hasUserUnlockedPlayback;

    setDesiredPlaybackState('playing');
    setIsTrackTransitioning(true);
    setPendingManualPlay(forceUserUnlock);
    setIsPlaying(true);

    if (track && loadTrackForImmediatePlayback(track)) {
      schedulePlayVideo();
      return;
    }

    schedulePlayVideo();
  }, [hasUserUnlockedPlayback, loadTrackForImmediatePlayback, schedulePlayVideo]);

  const setTrack = useCallback((index, options = {}) => {
    const keepPlaying = shouldKeepPlaying(options);
    const safeIndex = !Array.isArray(playlist) || playlist.length === 0
      ? 0
      : Math.max(0, Math.min(Number(index), playlist.length - 1));
    const selectedTrack = playlist[safeIndex] || null;

    console.log('[PLAYER][TRACK_BEFORE_CHANGE]', {
      source: 'setTrack',
      isPlaying,
      currentTrackIndex,
      requestedIndex: index,
      safeIndex,
      keepPlaying,
      reason: options.reason || 'manual_select',
    });

    setCurrentTrackIndex(safeIndex);
    setCurrentTime(0);

    if (keepPlaying) {
      requestPlaybackForTrack(selectedTrack, options);
    } else {
      setIsTrackTransitioning(false);
      cueTrack(selectedTrack);
    }
  }, [
    playlist,
    isPlaying,
    currentTrackIndex,
    shouldKeepPlaying,
    requestPlaybackForTrack,
    cueTrack,
  ]);

  const next = useCallback((options = {}) => {
    const keepPlaying = shouldKeepPlaying(options);
    const nextIndex = playlist.length ? (currentTrackIndex + 1) % playlist.length : 0;
    const selectedTrack = playlist[nextIndex] || null;

    console.log('[PLAYER][NEXT_CLICK]', {
      isPlaying,
      currentTrackIndex,
      nextIndex,
      keepPlaying,
      reason: options.reason || 'manual',
    });

    setCurrentTrackIndex(nextIndex);
    setCurrentTime(0);

    if (keepPlaying) {
      requestPlaybackForTrack(selectedTrack, options);
    } else {
      setIsTrackTransitioning(false);
      cueTrack(selectedTrack);
    }
  }, [
    playlist,
    isPlaying,
    currentTrackIndex,
    shouldKeepPlaying,
    requestPlaybackForTrack,
    cueTrack,
  ]);

  const prev = useCallback((options = {}) => {
    const keepPlaying = shouldKeepPlaying(options);
    const nextIndex = playlist.length ? (currentTrackIndex - 1 + playlist.length) % playlist.length : 0;
    const selectedTrack = playlist[nextIndex] || null;

    console.log('[PLAYER][PREV_CLICK]', {
      isPlaying,
      currentTrackIndex,
      nextIndex,
      keepPlaying,
      reason: options.reason || 'manual',
    });

    setCurrentTrackIndex(nextIndex);
    setCurrentTime(0);

    if (keepPlaying) {
      requestPlaybackForTrack(selectedTrack, options);
    } else {
      setIsTrackTransitioning(false);
      cueTrack(selectedTrack);
    }
  }, [
    playlist,
    isPlaying,
    currentTrackIndex,
    shouldKeepPlaying,
    requestPlaybackForTrack,
    cueTrack,
  ]);

  const play = useCallback(() => {
    setDesiredPlaybackState('playing');
    setPendingManualPlay(true);
    setIsPlaying(true);

    if (!playerRef) {
      console.log('[AUDIO_PLAYER][PLAY_REQUESTED]', { hasPlayer: false });
      return;
    }

    if (videoId) {
      playerRef.loadVideoById?.(videoId);
    }

    playerRef.playVideo?.();
    window.setTimeout(() => playerRef.playVideo?.(), 160);
    window.setTimeout(() => playerRef.playVideo?.(), 420);
    console.log('[AUDIO_PLAYER][PLAY_REQUESTED]', { hasPlayer: true, videoId });
  }, [playerRef, videoId]);

  const pause = useCallback(() => {
    setDesiredPlaybackState('paused');
    setPendingManualPlay(false);
    setIsTrackTransitioning(false);
    setIsPlaying(false);
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
    const initialTrack = normalizedPlaylist[nextIndex] || null;
    const shouldAutoPlay = normalizedPlaylist.length > 0 && options.autoplay === true;

    setPlaylist(normalizedPlaylist);
    setCurrentTrackIndex(nextIndex);
    setCurrentTime(0);
    console.log('[AUDIO_PLAYER][GLOBAL_INSTANCE]', {
      playlistSize: normalizedPlaylist.length,
      startIndex: nextIndex,
      requestedAutoplay: options.autoplay,
      effectiveAutoplay: shouldAutoPlay,
    });

    if (!shouldAutoPlay) {
      setIsPlaying(false);
      setDesiredPlaybackState('paused');
      setPendingManualPlay(false);
      setIsTrackTransitioning(false);
      console.log('[AUDIO_PLAYER][IS_PLAYING]', false);
      playerRef?.pauseVideo?.();
      cueTrack(initialTrack);
      return;
    }

    requestPlaybackForTrack(initialTrack, { manual: true, forcePlay: true, reason: 'replace_playlist_autoplay' });
  }, [
    playerRef,
    cueTrack,
    requestPlaybackForTrack,
  ]);

  const closeSession = useCallback(() => {
    setPlaylist([]);
    setCurrentTrackIndex(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setDesiredPlaybackState('paused');
    setPendingManualPlay(false);
    setIsTrackTransitioning(false);
    setHasUserUnlockedPlayback(false);
    playerRef?.stopVideo?.();
  }, [playerRef]);

  const state = useMemo(() => ({
    isPlaying,
    currentTrackIndex,
    currentTime,
    videoId,
    playlist,
    volume,
    playerRef,
    currentTrack,
    desiredPlaybackState,
    pendingManualPlay,
    hasUserUnlockedPlayback,
    isTrackTransitioning,
  }), [
    isPlaying,
    currentTrackIndex,
    currentTime,
    videoId,
    playlist,
    volume,
    playerRef,
    currentTrack,
    desiredPlaybackState,
    pendingManualPlay,
    hasUserUnlockedPlayback,
    isTrackTransitioning,
  ]);

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
    setDesiredPlaybackState,
    setPendingManualPlay,
    setHasUserUnlockedPlayback,
    setIsTrackTransitioning,
    replacePlaylist,
    closeSession,
  }), [
    play,
    pause,
    next,
    prev,
    seek,
    setTrack,
    replacePlaylist,
    closeSession,
    setPlayerRef,
    setIsPlaying,
    setDesiredPlaybackState,
    setPendingManualPlay,
    setHasUserUnlockedPlayback,
    setIsTrackTransitioning,
  ]);

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
