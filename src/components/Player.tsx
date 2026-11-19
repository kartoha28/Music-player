import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ChevronDown,
  ExternalLink,
  FolderPlus,
  Heart,
  ListMusic,
  Loader2,
  Maximize2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAudio } from '../hooks/useAudio';
import { useDominantColor } from '../hooks/useDominantColor';
import { useHotkeys } from '../hooks/useHotkeys';
import { useMediaSession } from '../hooks/useMediaSession';
import { useLibraryStore } from '../store/libraryStore';
import { selectCurrentTrack, usePlayerStore, type RepeatMode } from '../store/playerStore';
import { useSettingsStore } from '../store/settingsStore';
import { FALLBACK_ARTWORK_SVG, formatDuration, handleArtworkError } from '../utils/format';
import { GlassButton } from './GlassButton';
import { QueuePanel } from './QueuePanel';
import { Waveform } from './Waveform';

const SOURCE_LABELS: Record<string, string> = {
  audius: 'Audius',
  soundcloud: 'SoundCloud',
  spotify: 'Spotify',
  jamendo: 'Jamendo',
};

const REPEAT_LABELS: Record<RepeatMode, string> = {
  off: 'Повтор вимкнено',
  queue: 'Повтор усієї черги',
  one: 'Повтор одного треку',
};

export function Player() {
  useAudio();
  useMediaSession();
  useHotkeys();

  const currentTrack = usePlayerStore(selectCurrentTrack);
  const queueLength = usePlayerStore((s) => s.queue.length);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const playbackError = usePlayerStore((s) => s.playbackError);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const isShuffled = usePlayerStore((s) => s.isShuffled);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const isQueueOpen = usePlayerStore((s) => s.isQueueOpen);
  const isExpanded = usePlayerStore((s) => s.isExpanded);
  const visualizerFallback = usePlayerStore((s) => s.visualizerFallback);

  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const requestSeek = usePlayerStore((s) => s.requestSeek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeatMode = usePlayerStore((s) => s.cycleRepeatMode);
  const toggleQueue = usePlayerStore((s) => s.toggleQueue);
  const setExpanded = usePlayerStore((s) => s.setExpanded);
  const dynamicBackground = useSettingsStore((s) => s.dynamicBackground);
  const isCurrentLiked = useLibraryStore((s) =>
    currentTrack ? s.likedTracks.some((item) => item.id === currentTrack.id) : false,
  );
  const toggleLike = useLibraryStore((s) => s.toggleLike);
  const openPlaylistPicker = useLibraryStore((s) => s.openPlaylistPicker);

  useDominantColor(
    currentTrack?.artworkThumbnailUrl || currentTrack?.artworkUrl,
    currentTrack?.artworkMirrors,
    currentTrack?.id,
    dynamicBackground,
  );

  const pushedOverlayRef = useRef(false);
  const swipeStartRef = useRef<{ y: number; time: number } | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const closeExpanded = useCallback(() => {
    setDragOffsetY(0);
    setIsSwiping(false);
    swipeStartRef.current = null;
    const historyState = window.history.state as { waveOverlay?: string } | null;
    if (pushedOverlayRef.current && historyState?.waveOverlay === 'player') {
      pushedOverlayRef.current = false;
      setExpanded(false);
      window.history.back();
      return;
    }
    pushedOverlayRef.current = false;
    setExpanded(false);
  }, [setExpanded]);

  useEffect(() => {
    if (!isExpanded) {
      pushedOverlayRef.current = false;
      setDragOffsetY(0);
      setIsSwiping(false);
      return;
    }

    const currentState = (window.history.state as Record<string, unknown> | null) ?? {};
    if (currentState.waveOverlay !== 'player' && currentState.waveOverlay !== 'queue') {
      window.history.pushState({ ...currentState, waveOverlay: 'player' }, '', window.location.href);
      pushedOverlayRef.current = true;
    }

    const handlePopState = () => {
      const nextState = window.history.state as { waveOverlay?: string } | null;
      if (nextState?.waveOverlay !== 'player' && nextState?.waveOverlay !== 'queue') {
        pushedOverlayRef.current = false;
        setExpanded(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isExpanded, setExpanded]);

  useEffect(() => {
    if (!isExpanded || isQueueOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeExpanded();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isExpanded, isQueueOpen, closeExpanded]);

  const handleSwipeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('button, a, input, [role="slider"]')) return;
    swipeStartRef.current = { y: event.clientY, time: Date.now() };
    setIsSwiping(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSwipeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!swipeStartRef.current) return;
    const delta = Math.max(0, event.clientY - swipeStartRef.current.y);
    setDragOffsetY(delta);
  };

  const handleSwipeEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!swipeStartRef.current) return;
    const elapsed = Math.max(1, Date.now() - swipeStartRef.current.time);
    const delta = Math.max(0, event.clientY - swipeStartRef.current.y);
    const velocity = delta / elapsed;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    swipeStartRef.current = null;
    setIsSwiping(false);

    if (delta > 90 || (delta > 36 && velocity > 0.45)) {
      closeExpanded();
    } else {
      setDragOffsetY(0);
    }
  };

  const effectiveVolume = isMuted ? 0 : volume;
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const VolumeIcon =
    effectiveVolume === 0 ? VolumeX : effectiveVolume < 0.5 ? Volume1 : Volume2;
  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;

  return (
    <>
      {/* Десктопна постійна скляна панель плеєра */}
      <section
        aria-label="Аудіоплеєр"
        className="hidden lg:grid fixed bottom-4 left-[calc(var(--sidebar-width)+1.75rem)] right-6 z-40 h-[var(--player-bar-height)] px-5 glass-panel-strong glass-refractable grid-cols-[minmax(220px,1.05fr)_minmax(340px,1.8fr)_minmax(210px,0.9fr)] items-center gap-4"
      >
        {/* Інформація про трек */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => currentTrack && setExpanded(true)}
            disabled={!currentTrack}
            aria-label={currentTrack ? 'Розгорнути повноекранний плеєр' : 'Немає активного треку'}
            className="relative h-13 w-13 shrink-0 overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-elevated)] cursor-pointer disabled:cursor-default p-0"
          >
            <img
              key={currentTrack?.id ?? 'desktop-idle'}
              src={currentTrack?.artworkThumbnailUrl || currentTrack?.artworkUrl || FALLBACK_ARTWORK_SVG}
              alt={currentTrack ? `Обкладинка ${currentTrack.title}` : 'Обкладинка відсутня'}
              width={52}
              height={52}
              onError={(event) => handleArtworkError(event, currentTrack?.artworkMirrors)}
              className="h-full w-full object-cover"
            />
          </button>

          <div className="min-w-0 flex-1">
            {currentTrack ? (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <p
                    className="m-0 truncate text-sm font-semibold text-[var(--text-primary)]"
                    title={currentTrack.title}
                  >
                    {currentTrack.title}
                  </p>
                  <span className="shrink-0 rounded-full border border-[var(--glass-border-subtle)] bg-[var(--glass-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                    {SOURCE_LABELS[currentTrack.source] ?? currentTrack.source}
                  </span>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  {currentTrack.artistId ? (
                    <Link
                      to={`/artist/${encodeURIComponent(currentTrack.artistId)}`}
                      className="truncate text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline hover:underline"
                    >
                      {currentTrack.artist}
                    </Link>
                  ) : (
                    <span className="truncate text-xs text-[var(--text-secondary)]">
                      {currentTrack.artist}
                    </span>
                  )}

                  {playbackError && (
                    <span
                      title={playbackError}
                      className="inline-flex items-center gap-1 text-[11px] text-rose-400 shrink-0"
                    >
                      <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Помилка</span>
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div>
                <p className="m-0 text-sm font-semibold text-[var(--text-primary)]">
                  Оберіть трек
                </p>
                <p className="m-0 text-xs text-[var(--text-muted)]">
                  Плеєр готовий до відтворення
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Центр: хвиля зверху (щоб тултіп не перекривав кнопки) + кнопки керування */}
        <div className="flex flex-col items-center gap-1 min-w-0">
          <div className="flex w-full items-center gap-2.5">
            <span className="w-10 text-right text-[11px] font-medium text-[var(--text-muted)] tabular-nums">
              {formatDuration(currentTime)}
            </span>

            <div className="flex-1 min-w-0">
              <Waveform
                trackId={currentTrack?.id}
                currentTime={currentTime}
                duration={duration}
                isPlaying={isPlaying}
                visualizerFallback={visualizerFallback}
                onSeek={requestSeek}
                variant="compact"
                disabled={!currentTrack || duration <= 0}
              />
            </div>

            <span className="w-10 text-[11px] font-medium text-[var(--text-muted)] tabular-nums">
              {formatDuration(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <GlassButton
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${isShuffled ? 'text-[var(--accent)]' : ''}`}
              aria-label={isShuffled ? 'Вимкнути випадковий порядок' : 'Увімкнути випадковий порядок'}
              aria-pressed={isShuffled}
              title="Перемішати (Shuffle)"
              disabled={queueLength < 2}
              onClick={toggleShuffle}
            >
              <Shuffle className="h-4 w-4" aria-hidden="true" />
            </GlassButton>

            <GlassButton
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Попередній трек (P)"
              title="Попередній трек (P)"
              disabled={!currentTrack}
              onClick={previous}
            >
              <SkipBack className="h-4 w-4 fill-current" aria-hidden="true" />
            </GlassButton>

            <GlassButton
              variant="primary"
              size="icon"
              className="h-9 w-9"
              aria-label={isPlaying ? 'Пауза (Пробіл)' : 'Відтворити (Пробіл)'}
              title={isPlaying ? 'Пауза (Пробіл)' : 'Відтворити (Пробіл)'}
              disabled={!currentTrack}
              onClick={togglePlay}
            >
              {isBuffering && isPlaying ? (
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4 fill-current" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4 fill-current translate-x-0.5" aria-hidden="true" />
              )}
            </GlassButton>

            <GlassButton
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Наступний трек (N)"
              title="Наступний трек (N)"
              disabled={!currentTrack}
              onClick={() => next(false)}
            >
              <SkipForward className="h-4 w-4 fill-current" aria-hidden="true" />
            </GlassButton>

            <GlassButton
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${repeatMode !== 'off' ? 'text-[var(--accent)]' : ''}`}
              aria-label={REPEAT_LABELS[repeatMode]}
              title={REPEAT_LABELS[repeatMode]}
              disabled={!currentTrack}
              onClick={cycleRepeatMode}
            >
              <RepeatIcon className="h-4 w-4" aria-hidden="true" />
            </GlassButton>
          </div>
        </div>

        {/* Праворуч: лайк, черга, гучність, розгортання */}
        <div className="flex items-center justify-end gap-1.5">
          {currentTrack && (
            <>
              <GlassButton
                variant="ghost"
                size="icon"
                className={`h-9 w-9 ${isCurrentLiked ? 'text-[var(--accent)]' : ''}`}
                onClick={() => toggleLike(currentTrack)}
                aria-pressed={isCurrentLiked}
                aria-label={isCurrentLiked ? 'Прибрати з вподобаних' : 'Вподобати трек'}
                title={isCurrentLiked ? 'Прибрати з вподобаних' : 'Вподобати трек'}
              >
                <Heart className={`h-4 w-4 ${isCurrentLiked ? 'fill-current' : ''}`} aria-hidden="true" />
              </GlassButton>

              <GlassButton
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => openPlaylistPicker(currentTrack)}
                aria-label="Додати трек у плейлист"
                title="Додати у плейлист"
              >
                <FolderPlus className="h-4 w-4" aria-hidden="true" />
              </GlassButton>
            </>
          )}

          <GlassButton
            variant={isQueueOpen ? 'primary' : 'glass'}
            size="sm"
            onClick={toggleQueue}
            aria-label="Відкрити чергу відтворення"
            aria-expanded={isQueueOpen}
            className="px-3"
          >
            <ListMusic className="h-4 w-4" aria-hidden="true" />
            <span className="tabular-nums text-xs">{queueLength}</span>
          </GlassButton>

          <GlassButton
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={toggleMute}
            aria-label={isMuted || volume === 0 ? 'Увімкнути звук (M)' : 'Вимкнути звук (M)'}
            title={isMuted || volume === 0 ? 'Увімкнути звук (M)' : 'Вимкнути звук (M)'}
          >
            <VolumeIcon className="h-4 w-4" aria-hidden="true" />
          </GlassButton>

          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={effectiveVolume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Гучність"
            style={{ accentColor: 'var(--accent)' }}
            className="w-20 cursor-pointer"
          />

          <GlassButton
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            disabled={!currentTrack}
            onClick={() => setExpanded(true)}
            aria-label="Розгорнути повноекранний плеєр"
            title="Розгорнути плеєр"
          >
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </GlassButton>
        </div>
      </section>

      {/* Мобільна компактна скляна панель плеєра */}
      <section
        aria-label="Міні-плеєр"
        className="lg:hidden fixed left-3 right-3 bottom-[calc(var(--mobile-nav-height)+0.75rem)] z-40 glass-panel-strong glass-refractable overflow-hidden"
      >
        <div className="h-0.5 w-full bg-[var(--glass-border-subtle)]">
          <div
            className="h-full bg-[var(--accent)] transition-[width] duration-150"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center gap-2.5 px-3 py-2">
          <button
            type="button"
            onClick={() => currentTrack && setExpanded(true)}
            disabled={!currentTrack}
            aria-label={
              currentTrack
                ? `Розгорнути плеєр: ${currentTrack.title}`
                : 'Плеєр: трек не вибрано'
            }
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left bg-transparent border-0 p-0 cursor-pointer disabled:cursor-default"
          >
            <img
              key={currentTrack?.id ?? 'mobile-idle'}
              src={currentTrack?.artworkThumbnailUrl || currentTrack?.artworkUrl || FALLBACK_ARTWORK_SVG}
              alt=""
              width={44}
              height={44}
              onError={(event) => handleArtworkError(event, currentTrack?.artworkMirrors)}
              className="h-11 w-11 shrink-0 rounded-xl object-cover border border-[var(--glass-border-subtle)] bg-[var(--bg-elevated)]"
            />
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-sm font-semibold text-[var(--text-primary)]">
                {currentTrack ? currentTrack.title : 'Оберіть трек'}
              </p>
              <p className="m-0 truncate text-xs text-[var(--text-secondary)]">
                {playbackError
                  ? playbackError
                  : currentTrack
                    ? currentTrack.artist
                    : 'Натисніть на будь-який трек для старту'}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <GlassButton
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={toggleQueue}
              aria-label="Черга відтворення"
            >
              <ListMusic className="h-4 w-4" aria-hidden="true" />
            </GlassButton>

            <GlassButton
              variant="primary"
              size="icon"
              className="h-9 w-9"
              disabled={!currentTrack}
              onClick={togglePlay}
              aria-label={isPlaying ? 'Пауза' : 'Відтворити'}
            >
              {isBuffering && isPlaying ? (
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4 fill-current" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4 fill-current translate-x-0.5" aria-hidden="true" />
              )}
            </GlassButton>

            <GlassButton
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              disabled={!currentTrack}
              onClick={() => next(false)}
              aria-label="Наступний трек"
            >
              <SkipForward className="h-4 w-4 fill-current" aria-hidden="true" />
            </GlassButton>
          </div>
        </div>
      </section>

      {/* Повноекранний розгорнутий плеєр */}
      <AnimatePresence>
        {isExpanded && currentTrack && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Розгорнутий аудіоплеєр"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            style={{
              transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
              transition: isSwiping ? 'none' : 'transform 220ms ease-out',
            }}
            className="fixed inset-0 z-50 glass-panel-strong rounded-none overflow-y-auto px-4 py-4 sm:px-8 sm:py-7 flex flex-col"
          >
            {/* Зона жесту свайпу вниз (ручка + шапка + обкладинка) */}
            <div
              onPointerDown={handleSwipeStart}
              onPointerMove={handleSwipeMove}
              onPointerUp={handleSwipeEnd}
              onPointerCancel={handleSwipeEnd}
              className="touch-pan-x"
            >
              <div className="mx-auto mb-3 flex justify-center lg:hidden" aria-hidden="true">
                <span className="h-1.5 w-12 rounded-full bg-[var(--text-muted)] opacity-55" />
              </div>

              <header className="mx-auto w-full max-w-2xl flex items-center justify-between gap-3">
                <GlassButton
                  variant="glass"
                  size="sm"
                  onClick={closeExpanded}
                  aria-label="Згорнути плеєр"
                  className="px-3 py-2"
                >
                  <ChevronDown className="h-5 w-5" aria-hidden="true" />
                  <span className="text-xs sm:text-sm">Назад</span>
                </GlassButton>

                <div className="text-center">
                  <p className="m-0 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    Зараз грає
                  </p>
                  <p className="m-0 text-xs font-semibold text-[var(--text-secondary)]">
                    {SOURCE_LABELS[currentTrack.source] ?? currentTrack.source}
                  </p>
                </div>

                <GlassButton
                  variant={isQueueOpen ? 'primary' : 'glass'}
                  size="icon"
                  onClick={toggleQueue}
                  aria-label="Відкрити чергу відтворення"
                >
                  <ListMusic className="h-5 w-5" aria-hidden="true" />
                </GlassButton>
              </header>

              <div className="mx-auto w-full max-w-xl pt-6 flex flex-col items-center">
                <div className="w-full max-w-[290px] sm:max-w-[340px] aspect-square overflow-hidden rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-elevated)] shadow-2xl">
                  <img
                    key={currentTrack.id}
                    src={currentTrack.artworkUrl || FALLBACK_ARTWORK_SVG}
                    alt={`Обкладинка ${currentTrack.title}`}
                    width={360}
                    height={360}
                    onError={(event) => handleArtworkError(event, currentTrack.artworkMirrors)}
                    className="h-full w-full object-cover pointer-events-none select-none"
                  />
                </div>
              </div>
            </div>

            <div className="mx-auto my-auto w-full max-w-xl py-5 flex flex-col items-center gap-6">
              <div className="w-full text-center space-y-1.5">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] line-clamp-2 m-0">
                  {currentTrack.title}
                </h2>

                {currentTrack.artistId ? (
                  <Link
                    to={`/artist/${encodeURIComponent(currentTrack.artistId)}`}
                    onClick={() => {
                      pushedOverlayRef.current = false;
                      setExpanded(false);
                    }}
                    className="inline-block text-sm sm:text-base font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline hover:underline"
                  >
                    {currentTrack.artist}
                  </Link>
                ) : (
                  <p className="m-0 text-sm sm:text-base font-medium text-[var(--text-secondary)]">
                    {currentTrack.artist}
                  </p>
                )}

                {playbackError && (
                  <p className="m-0 pt-1 text-xs font-medium text-rose-400">{playbackError}</p>
                )}
              </div>

              <div className="w-full space-y-2">
                <Waveform
                  trackId={currentTrack.id}
                  currentTime={currentTime}
                  duration={duration}
                  isPlaying={isPlaying}
                  visualizerFallback={visualizerFallback}
                  onSeek={requestSeek}
                  variant="expanded"
                  disabled={duration <= 0}
                />

                <div className="flex items-center justify-between text-xs font-medium text-[var(--text-muted)] tabular-nums">
                  <span>{formatDuration(currentTime)}</span>
                  <span>{formatDuration(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 sm:gap-5">
                <GlassButton
                  variant="ghost"
                  size="icon"
                  className={isShuffled ? 'text-[var(--accent)]' : ''}
                  aria-label="Перемішати"
                  aria-pressed={isShuffled}
                  disabled={queueLength < 2}
                  onClick={toggleShuffle}
                >
                  <Shuffle className="h-5 w-5" aria-hidden="true" />
                </GlassButton>

                <GlassButton
                  variant="glass"
                  size="icon"
                  className="h-12 w-12"
                  aria-label="Попередній трек"
                  onClick={previous}
                >
                  <SkipBack className="h-5 w-5 fill-current" aria-hidden="true" />
                </GlassButton>

                <GlassButton
                  variant="primary"
                  size="icon"
                  className="h-15 w-15"
                  aria-label={isPlaying ? 'Пауза' : 'Відтворити'}
                  onClick={togglePlay}
                >
                  {isBuffering && isPlaying ? (
                    <Loader2 className="h-6 w-6 motion-safe:animate-spin" aria-hidden="true" />
                  ) : isPlaying ? (
                    <Pause className="h-6 w-6 fill-current" aria-hidden="true" />
                  ) : (
                    <Play className="h-6 w-6 fill-current translate-x-0.5" aria-hidden="true" />
                  )}
                </GlassButton>

                <GlassButton
                  variant="glass"
                  size="icon"
                  className="h-12 w-12"
                  aria-label="Наступний трек"
                  onClick={() => next(false)}
                >
                  <SkipForward className="h-5 w-5 fill-current" aria-hidden="true" />
                </GlassButton>

                <GlassButton
                  variant="ghost"
                  size="icon"
                  className={repeatMode !== 'off' ? 'text-[var(--accent)]' : ''}
                  aria-label={REPEAT_LABELS[repeatMode]}
                  onClick={cycleRepeatMode}
                >
                  <RepeatIcon className="h-5 w-5" aria-hidden="true" />
                </GlassButton>
              </div>

              <div className="w-full flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[var(--glass-border-subtle)]">
                <div className="flex items-center gap-2.5 flex-1 min-w-[180px] max-w-xs">
                  <GlassButton
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={toggleMute}
                    aria-label={isMuted || volume === 0 ? 'Увімкнути звук' : 'Вимкнути звук'}
                  >
                    <VolumeIcon className="h-4 w-4" aria-hidden="true" />
                  </GlassButton>

                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={effectiveVolume}
                    onChange={(event) => setVolume(Number(event.target.value))}
                    aria-label="Гучність"
                    style={{ accentColor: 'var(--accent)' }}
                    className="w-full cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <GlassButton
                    variant="glass"
                    size="icon"
                    className={`h-9 w-9 ${isCurrentLiked ? 'text-[var(--accent)]' : ''}`}
                    onClick={() => toggleLike(currentTrack)}
                    aria-pressed={isCurrentLiked}
                    aria-label={isCurrentLiked ? 'Прибрати з вподобаних' : 'Вподобати трек'}
                  >
                    <Heart
                      className={`h-4 w-4 ${isCurrentLiked ? 'fill-current' : ''}`}
                      aria-hidden="true"
                    />
                  </GlassButton>

                  <GlassButton
                    variant="glass"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => openPlaylistPicker(currentTrack)}
                    aria-label="Додати трек у плейлист"
                  >
                    <FolderPlus className="h-4 w-4" aria-hidden="true" />
                  </GlassButton>

                  {currentTrack.permalinkUrl && (
                    <a
                      href={currentTrack.permalinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="no-underline"
                    >
                      <GlassButton variant="glass" size="sm">
                        <span>Відкрити оригінал</span>
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </GlassButton>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <QueuePanel />
    </>
  );
}
