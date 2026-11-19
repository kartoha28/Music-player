import { useEffect, useRef } from 'react';
import { getProvider } from '../providers';
import { selectCurrentTrack, usePlayerStore } from '../store/playerStore';

let sharedAudioContext: AudioContext | null = null;
let sharedCorsSource: MediaElementAudioSourceNode | null = null;
let sharedAnalyser: AnalyserNode | null = null;

export function getActiveAnalyser(): AnalyserNode | null {
  return sharedAnalyser;
}

export function useAudio(): void {
  const currentTrack = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const seekRequest = usePlayerStore((s) => s.seekRequest);
  const visualizerFallback = usePlayerStore((s) => s.visualizerFallback);

  const corsAudioRef = useRef<HTMLAudioElement | null>(null);
  const plainAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeModeRef = useRef<'cors' | 'plain'>('cors');
  const streamUrlRef = useRef<string | null>(null);
  const loadedTrackIdRef = useRef<string | null>(null);
  const lastSavedTimeRef = useRef<number>(0);
  const pendingSeekRef = useRef<number | null>(null);

  const getActiveAudio = (): HTMLAudioElement | null =>
    activeModeRef.current === 'plain' ? plainAudioRef.current : corsAudioRef.current;

  const ensureAudioGraph = () => {
    const corsAudio = corsAudioRef.current;
    if (!corsAudio || sharedAnalyser) return;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        usePlayerStore.getState().setPlaybackMetrics({ visualizerFallback: true });
        return;
      }

      if (!sharedAudioContext) {
        sharedAudioContext = new AudioCtx();
      }
      if (!sharedCorsSource) {
        sharedCorsSource = sharedAudioContext.createMediaElementSource(corsAudio);
        sharedAnalyser = sharedAudioContext.createAnalyser();
        sharedAnalyser.fftSize = 128;
        sharedAnalyser.smoothingTimeConstant = 0.8;
        sharedCorsSource.connect(sharedAnalyser);
        sharedAnalyser.connect(sharedAudioContext.destination);
      }
    } catch {
      usePlayerStore.getState().setPlaybackMetrics({ visualizerFallback: true });
    }
  };

  // Створення HTML5 audio елементів і підписка на події
  useEffect(() => {
    const corsAudio = new Audio();
    corsAudio.crossOrigin = 'anonymous';
    corsAudio.preload = 'metadata';

    const plainAudio = new Audio();
    plainAudio.preload = 'metadata';

    corsAudioRef.current = corsAudio;
    plainAudioRef.current = plainAudio;

    const handleLoadedMetadata = (mode: 'cors' | 'plain') => () => {
      if (activeModeRef.current !== mode) return;
      const el = mode === 'cors' ? corsAudio : plainAudio;
      const store = usePlayerStore.getState();

      if (Number.isFinite(el.duration) && el.duration > 0) {
        store.setPlaybackMetrics({ duration: el.duration });
      }

      const restorePos = pendingSeekRef.current ?? store.pendingRestorePosition;
      if (restorePos !== null && restorePos > 0) {
        const clamped =
          Number.isFinite(el.duration) && el.duration > 0
            ? Math.min(restorePos, el.duration)
            : restorePos;
        try {
          el.currentTime = clamped;
        } catch {
          // Деякі браузери можуть відхилити ранній seek до першого чанку
        }
        pendingSeekRef.current = null;
        if (store.pendingRestorePosition !== null) {
          store.clearPendingRestore();
        }
      }
    };

    const handleTimeUpdate = (mode: 'cors' | 'plain') => () => {
      if (activeModeRef.current !== mode) return;
      const el = mode === 'cors' ? corsAudio : plainAudio;
      const store = usePlayerStore.getState();

      store.setPlaybackMetrics({ currentTime: el.currentTime });

      if (Math.abs(el.currentTime - lastSavedTimeRef.current) >= 3) {
        lastSavedTimeRef.current = el.currentTime;
        store.commitSavedPosition(el.currentTime);
      }
    };

    const handleWaiting = (mode: 'cors' | 'plain') => () => {
      if (activeModeRef.current !== mode) return;
      usePlayerStore.getState().setPlaybackMetrics({ isBuffering: true });
    };

    const handleCanPlayOrPlaying = (mode: 'cors' | 'plain') => () => {
      if (activeModeRef.current !== mode) return;
      usePlayerStore.getState().setPlaybackMetrics({
        isBuffering: false,
        playbackError: null,
      });
    };

    const handlePause = (mode: 'cors' | 'plain') => () => {
      if (activeModeRef.current !== mode) return;
      const el = mode === 'cors' ? corsAudio : plainAudio;
      lastSavedTimeRef.current = el.currentTime;
      usePlayerStore.getState().commitSavedPosition(el.currentTime);
    };

    const handleEnded = (mode: 'cors' | 'plain') => () => {
      if (activeModeRef.current !== mode) return;
      usePlayerStore.getState().next(true);
    };

    const handleError = (mode: 'cors' | 'plain') => () => {
      if (activeModeRef.current !== mode) return;
      const store = usePlayerStore.getState();

      // Якщо CORS-елемент не зміг завантажити потік — переключаємося на безпечний резервний <audio>
      if (mode === 'cors' && streamUrlRef.current) {
        const resumeAt = corsAudio.currentTime > 0 ? corsAudio.currentTime : store.currentTime;
        corsAudio.pause();
        corsAudio.removeAttribute('src');
        corsAudio.load();

        activeModeRef.current = 'plain';
        pendingSeekRef.current = resumeAt > 0 ? resumeAt : null;
        store.setPlaybackMetrics({ visualizerFallback: true });

        plainAudio.volume = store.isMuted ? 0 : store.volume;
        plainAudio.muted = store.isMuted;
        plainAudio.src = streamUrlRef.current;
        plainAudio.load();

        if (store.isPlaying) {
          void plainAudio.play().catch(() => {
            usePlayerStore.getState().setPlaying(false);
          });
        }
        return;
      }

      store.setPlaybackMetrics({
        isBuffering: false,
        playbackError: 'Не вдалося відтворити аудіопотік. Спробуйте інший трек або повторіть пізніше.',
      });
      store.setPlaying(false);
    };

    const listeners: Array<[HTMLAudioElement, string, EventListener]> = [
      [corsAudio, 'loadedmetadata', handleLoadedMetadata('cors')],
      [corsAudio, 'timeupdate', handleTimeUpdate('cors')],
      [corsAudio, 'waiting', handleWaiting('cors')],
      [corsAudio, 'canplay', handleCanPlayOrPlaying('cors')],
      [corsAudio, 'playing', handleCanPlayOrPlaying('cors')],
      [corsAudio, 'pause', handlePause('cors')],
      [corsAudio, 'ended', handleEnded('cors')],
      [corsAudio, 'error', handleError('cors')],
      [plainAudio, 'loadedmetadata', handleLoadedMetadata('plain')],
      [plainAudio, 'timeupdate', handleTimeUpdate('plain')],
      [plainAudio, 'waiting', handleWaiting('plain')],
      [plainAudio, 'canplay', handleCanPlayOrPlaying('plain')],
      [plainAudio, 'playing', handleCanPlayOrPlaying('plain')],
      [plainAudio, 'pause', handlePause('plain')],
      [plainAudio, 'ended', handleEnded('plain')],
      [plainAudio, 'error', handleError('plain')],
    ];

    for (const [el, event, fn] of listeners) {
      el.addEventListener(event, fn);
    }

    const handleBeforeUnload = () => {
      const el = getActiveAudio();
      if (el && Number.isFinite(el.currentTime)) {
        usePlayerStore.getState().commitSavedPosition(el.currentTime);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      for (const [el, event, fn] of listeners) {
        el.removeEventListener(event, fn);
      }
      corsAudio.pause();
      corsAudio.removeAttribute('src');
      corsAudio.load();
      plainAudio.pause();
      plainAudio.removeAttribute('src');
      plainAudio.load();
    };
  }, []);

  // Синхронізація гучності й mute
  useEffect(() => {
    const effective = isMuted ? 0 : volume;
    if (corsAudioRef.current) {
      corsAudioRef.current.volume = effective;
      corsAudioRef.current.muted = isMuted;
    }
    if (plainAudioRef.current) {
      plainAudioRef.current.volume = effective;
      plainAudioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Завантаження нового треку при зміні currentTrack
  useEffect(() => {
    const corsAudio = corsAudioRef.current;
    const plainAudio = plainAudioRef.current;
    if (!corsAudio || !plainAudio) return;

    const resetAudioElements = () => {
      corsAudio.pause();
      corsAudio.removeAttribute('src');
      corsAudio.load();
      plainAudio.pause();
      plainAudio.removeAttribute('src');
      plainAudio.load();
    };

    if (!currentTrack) {
      loadedTrackIdRef.current = null;
      streamUrlRef.current = null;
      resetAudioElements();
      return;
    }

    if (currentTrack.source === 'soundcloud') {
      loadedTrackIdRef.current = currentTrack.id;
      streamUrlRef.current = null;
      resetAudioElements();
      usePlayerStore.getState().setPlaybackMetrics({
        isBuffering: false,
        visualizerFallback: true,
      });
      return;
    }

    if (loadedTrackIdRef.current === currentTrack.id && streamUrlRef.current) {
      return;
    }

    let cancelled = false;
    loadedTrackIdRef.current = currentTrack.id;
    activeModeRef.current = 'cors';
    pendingSeekRef.current = null;
    lastSavedTimeRef.current = 0;

    plainAudio.pause();
    plainAudio.removeAttribute('src');
    plainAudio.load();

    usePlayerStore.getState().setPlaybackMetrics({
      visualizerFallback: false,
      playbackError: null,
    });

    const loadStream = async () => {
      try {
        const provider = getProvider(currentTrack.source);
        const url = provider
          ? await provider.getStreamUrl(currentTrack)
          : currentTrack.streamUrl;

        if (cancelled) return;

        if (!url) {
          usePlayerStore.getState().setPlaybackMetrics({
            isBuffering: false,
            playbackError: 'Для цього треку відсутній потік відтворення.',
          });
          usePlayerStore.getState().setPlaying(false);
          return;
        }

        streamUrlRef.current = url;
        corsAudio.src = url;
        corsAudio.load();

        const store = usePlayerStore.getState();
        if (store.isPlaying) {
          ensureAudioGraph();
          if (sharedAudioContext?.state === 'suspended') {
            await sharedAudioContext.resume().catch(() => undefined);
          }
          await corsAudio.play();
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;

        const store = usePlayerStore.getState();
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          store.setPlaying(false);
          store.setPlaybackMetrics({ isBuffering: false });
          return;
        }

        store.setPlaybackMetrics({
          isBuffering: false,
          playbackError: 'Не вдалося розпочати відтворення треку.',
        });
        store.setPlaying(false);
      }
    };

    void loadStream();

    return () => {
      cancelled = true;
    };
  }, [currentTrack]);

  // Синхронізація play / pause
  useEffect(() => {
    if (!currentTrack || currentTrack.source === 'soundcloud') return;
    const el = getActiveAudio();
    if (!el || !streamUrlRef.current) return;

    if (isPlaying) {
      if (activeModeRef.current === 'cors') {
        ensureAudioGraph();
        if (sharedAudioContext?.state === 'suspended') {
          void sharedAudioContext.resume().catch(() => undefined);
        }
      }

      if (el.paused) {
        void el.play().catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          if (err instanceof DOMException && err.name === 'NotAllowedError') {
            usePlayerStore.getState().setPlaying(false);
          }
        });
      }
    } else if (!el.paused) {
      el.pause();
    }
  }, [isPlaying, currentTrack]);

  // Обробка запиту перемотування
  useEffect(() => {
    if (!seekRequest || !currentTrack || currentTrack.source === 'soundcloud') return;
    const el = getActiveAudio();
    if (!el) return;

    if (el.readyState >= 1) {
      try {
        el.currentTime = seekRequest.time;
      } catch {
        pendingSeekRef.current = seekRequest.time;
      }
    } else {
      pendingSeekRef.current = seekRequest.time;
    }
  }, [seekRequest, currentTrack]);

  // Детекція нульового спектра (тихий CORS-блок Web Audio API)
  useEffect(() => {
    if (
      !isPlaying ||
      visualizerFallback ||
      !currentTrack ||
      currentTrack.source === 'soundcloud' ||
      activeModeRef.current !== 'cors' ||
      isMuted ||
      volume === 0
    ) {
      return;
    }

    let silentChecks = 0;
    const buf = new Uint8Array(64);

    const timer = window.setInterval(() => {
      const el = corsAudioRef.current;
      if (!sharedAnalyser || !el || el.paused || el.currentTime < 1.2) return;

      sharedAnalyser.getByteFrequencyData(buf);
      let hasSignal = false;
      for (let i = 0; i < buf.length; i++) {
        if (buf[i] > 0) {
          hasSignal = true;
          break;
        }
      }

      if (!hasSignal) {
        silentChecks += 1;
        if (silentChecks >= 2) {
          usePlayerStore.getState().setPlaybackMetrics({ visualizerFallback: true });
        }
      } else {
        silentChecks = 0;
      }
    }, 1500);

    return () => window.clearInterval(timer);
  }, [isPlaying, visualizerFallback, currentTrack, isMuted, volume]);
}
