import { useEffect, useRef } from 'react';
import { selectCurrentTrack, usePlayerStore } from '../store/playerStore';

export function useMediaSession(): void {
  const currentTrack = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const lastPositionSyncRef = useRef<number>(0);

  // Реєстрація системних обробників керування плеєром
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;

    const actions: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
      ['play', () => usePlayerStore.getState().setPlaying(true)],
      ['pause', () => usePlayerStore.getState().setPlaying(false)],
      ['previoustrack', () => usePlayerStore.getState().previous()],
      ['nexttrack', () => usePlayerStore.getState().next(false)],
      [
        'seekbackward',
        (details) => {
          const state = usePlayerStore.getState();
          state.requestSeek(state.currentTime - (details.seekOffset ?? 10));
        },
      ],
      [
        'seekforward',
        (details) => {
          const state = usePlayerStore.getState();
          state.requestSeek(state.currentTime + (details.seekOffset ?? 10));
        },
      ],
      [
        'seekto',
        (details) => {
          if (typeof details.seekTime === 'number') {
            usePlayerStore.getState().requestSeek(details.seekTime);
          }
        },
      ],
      ['stop', () => usePlayerStore.getState().setPlaying(false)],
    ];

    for (const [action, handler] of actions) {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // Окремі браузери не підтримують частину дій Media Session
      }
    }

    return () => {
      for (const [action] of actions) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          // Ігноруємо непідтримувані дії при очищенні
        }
      }
    };
  }, []);

  // Метадані треку
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;

    if (!currentTrack) {
      ms.metadata = null;
      ms.playbackState = 'none';
      return;
    }

    if (typeof MediaMetadata !== 'undefined') {
      const artwork: MediaImage[] = currentTrack.artworkUrl.startsWith('http')
        ? [{ src: currentTrack.artworkUrl, sizes: '480x480', type: 'image/jpeg' }]
        : [];

      ms.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.genre || 'Хвиля',
        artwork,
      });
    }
  }, [currentTrack]);

  // Стан відтворення
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = !currentTrack
      ? 'none'
      : isPlaying
        ? 'playing'
        : 'paused';
  }, [currentTrack, isPlaying]);

  // Позиція на шкалі блокування
  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      typeof navigator.mediaSession.setPositionState !== 'function'
    ) {
      return;
    }

    if (!currentTrack || !Number.isFinite(duration) || duration <= 0) return;

    const now = Date.now();
    if (isPlaying && now - lastPositionSyncRef.current < 4000) {
      return;
    }
    lastPositionSyncRef.current = now;

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(Math.max(0, currentTime), duration),
      });
    } catch {
      // Ігноруємо розбіжності в API позиції
    }
  }, [currentTrack, currentTime, duration, isPlaying]);
}
