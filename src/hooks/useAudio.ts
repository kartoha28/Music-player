import { useEffect, useRef, type RefObject } from 'react';
import { getProvider } from '../providers';
import { selectCurrentTrack, usePlayerStore } from '../store/playerStore';
import {
  loadSoundCloudWidgetApi,
  type SCPlayProgressEvent,
  type SCWidget,
} from '../utils/soundcloudWidget';

let sharedAudioContext: AudioContext | null = null;
let sharedCorsSource: MediaElementAudioSourceNode | null = null;
let sharedAnalyser: AnalyserNode | null = null;

export function getActiveAnalyser(): AnalyserNode | null {
  return sharedAnalyser;
}

export function useAudio(scIframeRef: RefObject<HTMLIFrameElement | null>): void {
  const currentTrack = usePlayerStore(selectCurrentTrack);
  const trackId = currentTrack?.id ?? null;
  const trackSource = currentTrack?.source ?? null;
  const trackEmbedSrc = currentTrack?.embedSrc ?? null;

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

  const scWidgetRef = useRef<SCWidget | null>(null);
  const scReadyRef = useRef<boolean>(false);
  const scFinishedRef = useRef<boolean>(false);
  const scLastSavedRef = useRef<number>(0);
  const scLastProgressAtRef = useRef<number>(0);
  const scPendingSeekRef = useRef<number | null>(null);
  const lastHandledSeekSeqRef = useRef<number>(0);

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
      const store = usePlayerStore.getState();
      const activeTrack = selectCurrentTrack(store);
      if (activeTrack?.source === 'soundcloud') {
        store.commitSavedPosition(store.currentTime);
        return;
      }
      const el = getActiveAudio();
      if (el && Number.isFinite(el.currentTime)) {
        store.commitSavedPosition(el.currentTime);
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

  // Синхронізація гучності й mute (HTML5 audio + SoundCloud Widget)
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
    if (scWidgetRef.current && scReadyRef.current) {
      try {
        scWidgetRef.current.setVolume(Math.round(effective * 100));
      } catch {
        // Ігноруємо поки віджет не готовий
      }
    }
  }, [volume, isMuted]);

  // Завантаження треку (HTML5 Audio або SoundCloud Widget API)
  useEffect(() => {
    const corsAudio = corsAudioRef.current;
    const plainAudio = plainAudioRef.current;
    if (!corsAudio || !plainAudio) return;

    const resetHtmlAudioElements = () => {
      corsAudio.pause();
      corsAudio.removeAttribute('src');
      corsAudio.load();
      plainAudio.pause();
      plainAudio.removeAttribute('src');
      plainAudio.load();
    };

    const track = selectCurrentTrack(usePlayerStore.getState());
    if (!track || track.id !== trackId) {
      loadedTrackIdRef.current = null;
      streamUrlRef.current = null;
      scReadyRef.current = false;
      scWidgetRef.current = null;
      resetHtmlAudioElements();
      return;
    }

    // Режим SoundCloud Embed + Widget API
    if (track.source === 'soundcloud') {
      loadedTrackIdRef.current = track.id;
      streamUrlRef.current = null;
      resetHtmlAudioElements();

      scReadyRef.current = false;
      scFinishedRef.current = false;
      scLastSavedRef.current = 0;
      scPendingSeekRef.current = null;

      usePlayerStore.getState().setPlaybackMetrics({
        isBuffering: true,
        playbackError: null,
        visualizerFallback: true,
      });

      let disposed = false;
      let widget: SCWidget | null = null;
      let readyEvents: string[] = [];

      const readyTimer = window.setTimeout(() => {
        if (!disposed && !scReadyRef.current) {
          usePlayerStore.getState().setPlaybackMetrics({
            isBuffering: false,
            playbackError:
              'Не вдалося завантажити вбудований плеєр SoundCloud. Трек може бути недоступний для вбудовування.',
          });
          usePlayerStore.getState().setPlaying(false);
        }
      }, 12_000);

      const setupSoundCloudWidget = async () => {
        try {
          const iframe = scIframeRef.current;
          if (!iframe || disposed) return;

          if (!iframe.getAttribute('src')) {
            const provider = getProvider('soundcloud');
            const url = provider ? await provider.getStreamUrl(track) : track.embedSrc;
            if (disposed || !url) {
              if (!disposed) {
                usePlayerStore.getState().setPlaybackMetrics({
                  isBuffering: false,
                  playbackError: 'Цей трек не можна вбудувати з SoundCloud.',
                });
                usePlayerStore.getState().setPlaying(false);
              }
              return;
            }
            iframe.src = url;
          }

          const SC = await loadSoundCloudWidgetApi();
          if (disposed || !scIframeRef.current) return;

          widget = SC.Widget(scIframeRef.current);
          scWidgetRef.current = widget;
          const Events = SC.Widget.Events;
          readyEvents = [
            Events.READY,
            Events.PLAY,
            Events.PAUSE,
            Events.PLAY_PROGRESS,
            Events.FINISH,
            Events.ERROR,
          ];

          widget.bind(Events.READY, () => {
            if (disposed || !widget) return;
            window.clearTimeout(readyTimer);
            scReadyRef.current = true;

            const store = usePlayerStore.getState();
            store.setPlaybackMetrics({ isBuffering: false, playbackError: null });

            widget.setVolume(store.isMuted ? 0 : Math.round(store.volume * 100));

            widget.getDuration((ms) => {
              if (disposed || !Number.isFinite(ms) || ms <= 0) return;
              const sec = ms / 1000;
              usePlayerStore.getState().setPlaybackMetrics({ duration: sec });
              usePlayerStore.getState().updateTrackDuration(track.id, sec);
            });

            widget.getCurrentSound((sound) => {
              if (disposed) return;
              if (
                !sound ||
                sound.embeddable_by === 'none' ||
                sound.policy === 'BLOCK'
              ) {
                usePlayerStore.getState().setPlaybackMetrics({
                  isBuffering: false,
                  playbackError:
                    'Власник обмежив вбудоване відтворення цього треку на SoundCloud.',
                });
                usePlayerStore.getState().setPlaying(false);
                return;
              }

              const latest = usePlayerStore.getState();
              const restorePos = scPendingSeekRef.current ?? latest.pendingRestorePosition;
              if (latest.isPlaying) {
                scFinishedRef.current = false;
                widget?.play();
              }
              if (restorePos !== null && restorePos > 0) {
                window.setTimeout(() => {
                  if (disposed || !widget) return;
                  widget.seekTo(restorePos * 1000);
                  if (usePlayerStore.getState().isPlaying) {
                    widget.play();
                  }
                }, 150);
                scPendingSeekRef.current = null;
                if (latest.pendingRestorePosition !== null) {
                  latest.clearPendingRestore();
                }
              }
            });
          });

          widget.bind(Events.PLAY, () => {
            if (disposed) return;
            scFinishedRef.current = false;
            const store = usePlayerStore.getState();
            store.setPlaybackMetrics({ isBuffering: false, playbackError: null });
            if (!store.isPlaying) {
              store.setPlaying(true);
            }
            if (store.duration <= 0) {
              widget?.getDuration((ms) => {
                if (!disposed && Number.isFinite(ms) && ms > 0) {
                  const sec = ms / 1000;
                  usePlayerStore.getState().setPlaybackMetrics({ duration: sec });
                  usePlayerStore.getState().updateTrackDuration(track.id, sec);
                }
              });
            }
          });

          widget.bind(Events.PAUSE, () => {
            if (disposed || scFinishedRef.current) return;
            const store = usePlayerStore.getState();
            store.commitSavedPosition(store.currentTime);
            if (store.isPlaying) {
              store.setPlaying(false);
            }
          });

          widget.bind(Events.PLAY_PROGRESS, (payload) => {
            if (disposed) return;
            const data = payload as SCPlayProgressEvent | undefined;
            if (!data || !Number.isFinite(data.currentPosition)) return;
            scLastProgressAtRef.current = Date.now();
            const sec = data.currentPosition / 1000;
            const store = usePlayerStore.getState();
            store.setPlaybackMetrics({ currentTime: sec, isBuffering: false });
            if (Math.abs(sec - scLastSavedRef.current) >= 3) {
              scLastSavedRef.current = sec;
              store.commitSavedPosition(sec);
            }
          });

          widget.bind(Events.FINISH, () => {
            if (disposed) return;
            scFinishedRef.current = true;
            usePlayerStore.getState().next(true);
          });

          widget.bind(Events.ERROR, () => {
            if (disposed) return;
            window.clearTimeout(readyTimer);
            usePlayerStore.getState().setPlaybackMetrics({
              isBuffering: false,
              playbackError: 'Не вдалося відтворити трек через вбудований плеєр SoundCloud.',
            });
            usePlayerStore.getState().setPlaying(false);
          });
        } catch (err) {
          if (disposed) return;
          window.clearTimeout(readyTimer);
          usePlayerStore.getState().setPlaybackMetrics({
            isBuffering: false,
            playbackError:
              err instanceof Error && err.message
                ? err.message
                : 'Помилка ініціалізації вбудованого плеєра SoundCloud.',
          });
          usePlayerStore.getState().setPlaying(false);
        }
      };

      void setupSoundCloudWidget();

      return () => {
        disposed = true;
        window.clearTimeout(readyTimer);
        scReadyRef.current = false;
        if (widget) {
          try {
            widget.pause();
            for (const eventName of readyEvents) {
              widget.unbind(eventName);
            }
          } catch {
            // Ігноруємо помилки при розмонтуванні віджета
          }
        }
        scWidgetRef.current = null;
      };
    }

    // Режим Audius та інших прямих аудіо-провайдерів
    scReadyRef.current = false;
    scWidgetRef.current = null;

    if (loadedTrackIdRef.current === track.id && streamUrlRef.current) {
      return;
    }

    let cancelled = false;
    loadedTrackIdRef.current = track.id;
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
        const provider = getProvider(track.source);
        const url = provider
          ? await provider.getStreamUrl(track)
          : track.streamUrl;

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
  }, [trackId, trackSource, trackEmbedSrc, scIframeRef]);

  // Синхронізація play / pause
  useEffect(() => {
    if (!trackId) return;

    if (trackSource === 'soundcloud') {
      if (!scReadyRef.current || !scWidgetRef.current) return;
      try {
        if (isPlaying) {
          scFinishedRef.current = false;
          scWidgetRef.current.play();
        } else {
          scWidgetRef.current.pause();
        }
      } catch {
        // Ігноруємо помилки виклику віджета
      }
      return;
    }

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
  }, [isPlaying, trackId, trackSource]);

  // Обробка запиту перемотування
  useEffect(() => {
    if (!seekRequest || !trackId) return;
    if (seekRequest.seq === lastHandledSeekSeqRef.current) return;
    lastHandledSeekSeqRef.current = seekRequest.seq;

    if (trackSource === 'soundcloud') {
      if (scReadyRef.current && scWidgetRef.current) {
        try {
          scWidgetRef.current.seekTo(seekRequest.time * 1000);
          if (usePlayerStore.getState().isPlaying) {
            scFinishedRef.current = false;
            scWidgetRef.current.play();
          }
        } catch {
          scPendingSeekRef.current = seekRequest.time;
        }
      } else {
        scPendingSeekRef.current = seekRequest.time;
      }
      return;
    }

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
  }, [seekRequest, trackId, trackSource]);

  // Резервна синхронізація позиції та паузи для SoundCloud Widget API
  useEffect(() => {
    if (!isPlaying || trackSource !== 'soundcloud') return;

    const timer = window.setInterval(() => {
      const widget = scWidgetRef.current;
      if (!widget || !scReadyRef.current) return;

      if (Date.now() - scLastProgressAtRef.current > 1000) {
        try {
          widget.getPosition((ms) => {
            if (Number.isFinite(ms) && ms >= 0) {
              usePlayerStore.getState().setPlaybackMetrics({ currentTime: ms / 1000 });
            }
          });
        } catch {
          // Ігноруємо помилку опитування позиції
        }
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isPlaying, trackId, trackSource]);

  // Детекція нульового спектра (тихий CORS-блок Web Audio API)
  useEffect(() => {
    if (
      !isPlaying ||
      visualizerFallback ||
      !trackId ||
      trackSource === 'soundcloud' ||
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
  }, [isPlaying, visualizerFallback, trackId, trackSource, isMuted, volume]);
}
