import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ExternalLink,
  FolderPlus,
  Heart,
  Link2,
  ListPlus,
  ListStart,
  Loader2,
  Play,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { SOUNDCLOUD_EXAMPLES, resolveSoundCloudUrl, type Track } from '../providers';
import { useLibraryStore } from '../store/libraryStore';
import { usePlayerStore } from '../store/playerStore';
import { handleArtworkError } from '../utils/format';
import { GlassButton } from './GlassButton';

export function SoundCloudModal() {
  const isOpen = usePlayerStore((s) => s.isSoundCloudModalOpen);
  const initialUrl = usePlayerStore((s) => s.soundCloudInitialUrl);
  const closeModal = usePlayerStore((s) => s.closeSoundCloudModal);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const playNext = usePlayerStore((s) => s.playNext);
  const addToQueue = usePlayerStore((s) => s.addToQueue);

  const likedTracks = useLibraryStore((s) => s.likedTracks);
  const toggleLike = useLibraryStore((s) => s.toggleLike);
  const openPlaylistPicker = useLibraryStore((s) => s.openPlaylistPicker);

  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedTrack, setResolvedTrack] = useState<Track | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const pushedHistoryRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    const historyState = window.history.state as { waveOverlay?: string } | null;
    if (pushedHistoryRef.current && historyState?.waveOverlay === 'soundcloud') {
      pushedHistoryRef.current = false;
      closeModal();
      window.history.back();
      return;
    }
    pushedHistoryRef.current = false;
    closeModal();
  }, [closeModal]);

  const loadTrackFromUrl = useCallback(async (rawUrl: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    setActionNotice(null);

    try {
      const track = await resolveSoundCloudUrl(rawUrl, controller.signal);
      if (controller.signal.aborted) return;
      setResolvedTrack(track);
    } catch (err) {
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        return;
      }
      setResolvedTrack(null);
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Не вдалося завантажити трек із SoundCloud.',
      );
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      pushedHistoryRef.current = false;
      abortRef.current?.abort();
      setIsLoading(false);
      setError(null);
      setActionNotice(null);
      return;
    }

    if (initialUrl.trim()) {
      setUrl(initialUrl.trim());
      void loadTrackFromUrl(initialUrl.trim());
    }

    const currentState = (window.history.state as Record<string, unknown> | null) ?? {};
    if (currentState.waveOverlay !== 'soundcloud') {
      window.history.pushState(
        { ...currentState, waveOverlay: 'soundcloud' },
        '',
        window.location.href,
      );
      pushedHistoryRef.current = true;
    }

    const handlePopState = () => {
      const nextState = window.history.state as { waveOverlay?: string } | null;
      if (nextState?.waveOverlay !== 'soundcloud') {
        pushedHistoryRef.current = false;
        closeModal();
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, initialUrl, closeModal, handleClose, loadTrackFromUrl]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void loadTrackFromUrl(url);
  };

  const handleExample = (exampleUrl: string) => {
    setUrl(exampleUrl);
    void loadTrackFromUrl(exampleUrl);
  };

  const isLiked = Boolean(
    resolvedTrack && likedTracks.some((item) => item.id === resolvedTrack.id),
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={handleClose}
            aria-hidden="true"
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs"
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="sc-modal-title"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="pointer-events-auto w-full max-w-lg glass-panel-strong overflow-hidden flex flex-col max-h-[90vh]"
            >
              <header className="flex items-center justify-between gap-3 border-b border-[var(--glass-border-subtle)] px-5 py-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Link2 className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      id="sc-modal-title"
                      className="m-0 text-base font-semibold text-[var(--text-primary)] truncate"
                    >
                      Вбудований SoundCloud
                    </h2>
                    <p className="m-0 text-xs text-[var(--text-muted)] truncate">
                      Вставте посилання на публічний трек
                    </p>
                  </div>
                </div>

                <GlassButton
                  variant="glass"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleClose}
                  aria-label="Закрити вікно SoundCloud"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </GlassButton>
              </header>

              <div className="overflow-y-auto p-5 space-y-4">
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      placeholder="https://soundcloud.com/виконавець/трек"
                      aria-label="Посилання на трек SoundCloud"
                      autoFocus
                      className="flex-1 min-w-0 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                    />
                    <GlassButton
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={!url.trim() || isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                          <span>Завантаження...</span>
                        </>
                      ) : (
                        <span>Завантажити трек</span>
                      )}
                    </GlassButton>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[var(--text-muted)] inline-flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
                      Приклад:
                    </span>
                    {SOUNDCLOUD_EXAMPLES.map((example) => (
                      <GlassButton
                        key={example.url}
                        variant="glass"
                        size="sm"
                        onClick={() => handleExample(example.url)}
                      >
                        {example.label}
                      </GlassButton>
                    ))}
                  </div>
                </form>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-2xl border border-rose-500/45 bg-rose-500/15 p-3.5 text-xs sm:text-sm text-[var(--text-primary)]"
                  >
                    <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="m-0 leading-relaxed">{error}</p>
                  </div>
                )}

                {resolvedTrack && (
                  <div className="rounded-3xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 space-y-4">
                    <div className="flex items-center gap-3.5">
                      <img
                        src={resolvedTrack.artworkUrl}
                        alt={`Обкладинка ${resolvedTrack.title}`}
                        width={72}
                        height={72}
                        onError={handleArtworkError}
                        className="h-18 w-18 shrink-0 rounded-2xl object-cover border border-[var(--glass-border-subtle)] bg-[var(--bg-elevated)]"
                      />

                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="inline-flex rounded-full border border-[var(--glass-border-subtle)] bg-[var(--glass-bg)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                          SoundCloud · Embed
                        </span>
                        <h3 className="m-0 truncate text-base font-semibold text-[var(--text-primary)]">
                          {resolvedTrack.title}
                        </h3>
                        <p className="m-0 truncate text-xs sm:text-sm text-[var(--text-secondary)]">
                          {resolvedTrack.artist}
                        </p>
                      </div>

                      <a
                        href={resolvedTrack.permalinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Відкрити на SoundCloud"
                        aria-label="Відкрити на SoundCloud"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </a>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <GlassButton
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          playTrack(resolvedTrack);
                          handleClose();
                        }}
                      >
                        <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                        <span>Слухати</span>
                      </GlassButton>

                      <GlassButton
                        variant="glass"
                        size="sm"
                        onClick={() => {
                          playNext(resolvedTrack);
                          setActionNotice('Додано наступним у чергу.');
                        }}
                      >
                        <ListStart className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Наступним</span>
                      </GlassButton>

                      <GlassButton
                        variant="glass"
                        size="sm"
                        onClick={() => {
                          addToQueue(resolvedTrack);
                          setActionNotice('Додано в чергу відтворення.');
                        }}
                      >
                        <ListPlus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>У чергу</span>
                      </GlassButton>

                      <GlassButton
                        variant="glass"
                        size="icon"
                        className={`h-8 w-8 ${isLiked ? 'text-[var(--accent)]' : ''}`}
                        aria-pressed={isLiked}
                        aria-label={isLiked ? 'Прибрати лайк' : 'Вподобати трек'}
                        onClick={() => toggleLike(resolvedTrack)}
                      >
                        <Heart
                          className={`h-3.5 w-3.5 ${isLiked ? 'fill-current' : ''}`}
                          aria-hidden="true"
                        />
                      </GlassButton>

                      <GlassButton
                        variant="glass"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Додати у плейлист"
                        onClick={() => openPlaylistPicker(resolvedTrack)}
                      >
                        <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                      </GlassButton>
                    </div>

                    {actionNotice && (
                      <p role="status" className="m-0 text-xs font-medium text-[var(--accent)]">
                        {actionNotice}
                      </p>
                    )}
                  </div>
                )}

                <p className="m-0 text-xs leading-relaxed text-[var(--text-muted)]">
                  Використовується офіційний SoundCloud oEmbed та Widget API без витягування
                  аудіофайлів. Якщо автор заборонив вбудовування треку, відтворення буде
                  недоступне.
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
