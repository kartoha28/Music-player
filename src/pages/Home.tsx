import { Clock, ExternalLink, Flame, Headphones, Pause, Play, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';
import {
  EmptyState,
  ErrorState,
  HeroSkeleton,
  StageNotice,
  TrackCardSkeleton,
} from '../components/Skeleton';
import { TrackCard } from '../components/TrackCard';
import { AUDIUS_GENRES, getDefaultProvider, type Track } from '../providers';
import { selectCurrentTrack, usePlayerStore } from '../store/playerStore';
import { formatCountWithUnit, formatDuration, handleArtworkError } from '../utils/format';

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

export default function Home() {
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [heroTrack, setHeroTrack] = useState<Track | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState<number>(0);
  const [notice, setNotice] = useState<string | null>(null);

  const currentTrack = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const recentlyPlayed = usePlayerStore((s) => s.recentlyPlayed);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const playNext = usePlayerStore((s) => s.playNext);
  const addToQueue = usePlayerStore((s) => s.addToQueue);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const controller = new AbortController();
    const provider = getDefaultProvider();

    setIsLoading(true);
    setError(null);

    const loadTrending = async () => {
      try {
        const list = await provider.getTrending(selectedGenre || undefined, controller.signal);
        if (controller.signal.aborted) return;

        setTracks(list);

        if (!selectedGenre) {
          setHeroTrack(list[0] ?? null);
        } else if (!heroTrack) {
          const allTrending = await provider.getTrending(undefined, controller.signal);
          if (!controller.signal.aborted) {
            setHeroTrack(allTrending[0] ?? list[0] ?? null);
          }
        }
      } catch (err) {
        if (isAbortError(err)) return;
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Не вдалося завантажити трендові треки з Audius.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadTrending();

    return () => {
      controller.abort();
    };
  }, [selectedGenre, reloadTick]);

  const handleRetry = () => {
    getDefaultProvider().clearCache?.();
    setReloadTick((tick) => tick + 1);
  };

  const handlePlayNext = (track: Track) => {
    playNext(track);
    setNotice(`«${track.title}» гратиме наступним.`);
  };

  const handleAddToQueue = (track: Track) => {
    addToQueue(track);
    setNotice(`«${track.title}» додано в чергу.`);
  };

  const activeGenreLabel =
    AUDIUS_GENRES.find((genre) => genre.value === selectedGenre)?.label ?? 'Усі';
  const isHeroActive = Boolean(heroTrack && currentTrack?.id === heroTrack.id);

  return (
    <div className="space-y-8">
      {/* Герой із трендовим треком */}
      <section aria-labelledby="hero-heading">
        {isLoading && !heroTrack ? (
          <HeroSkeleton />
        ) : heroTrack ? (
          <GlassCard
            radius="xl"
            spotlight
            refract
            className="p-6 sm:p-8 lg:p-10 flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center"
          >
            <div className="relative w-full max-w-[240px] sm:w-56 md:w-64 aspect-square shrink-0 overflow-hidden rounded-3xl bg-[var(--bg-elevated)] shadow-2xl border border-[var(--glass-border)]">
              <img
                key={heroTrack.id}
                src={heroTrack.artworkUrl}
                alt={`Обкладинка трендового треку ${heroTrack.title}`}
                width={320}
                height={320}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onError={(event) => handleArtworkError(event, heroTrack.artworkMirrors)}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex-1 min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3.5 py-1 text-xs font-semibold text-[var(--text-primary)]">
                  <Flame className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
                  Трек у тренді
                </span>
                {heroTrack.genre && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--glass-border-subtle)] bg-[var(--glass-bg)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                    <Sparkles className="h-3 w-3 text-[var(--accent)]" aria-hidden="true" />
                    {heroTrack.genre}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <h1
                  id="hero-heading"
                  className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[var(--text-primary)] line-clamp-2"
                >
                  {heroTrack.title}
                </h1>

                <p className="text-base sm:text-lg text-[var(--text-secondary)]">
                  {heroTrack.artistId ? (
                    <Link
                      to={`/artist/${encodeURIComponent(heroTrack.artistId)}`}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline hover:underline font-medium"
                    >
                      {heroTrack.artist}
                    </Link>
                  ) : (
                    <span className="font-medium">{heroTrack.artist}</span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  {formatDuration(heroTrack.duration)}
                </span>
                {heroTrack.playCount !== undefined && (
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Headphones className="h-4 w-4" aria-hidden="true" />
                    {formatCountWithUnit(
                      heroTrack.playCount,
                      'прослуховування',
                      'прослуховування',
                      'прослуховувань',
                    )}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <GlassButton
                  variant="primary"
                  size="lg"
                  onClick={() =>
                    playTrack(heroTrack, tracks.length > 0 ? tracks : [heroTrack])
                  }
                >
                  {isHeroActive && isPlaying ? (
                    <>
                      <Pause className="h-4 w-4 fill-current" aria-hidden="true" />
                      <span>Пауза</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                      <span>Слухати</span>
                    </>
                  )}
                </GlassButton>

                <a
                  href={heroTrack.permalinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-underline"
                >
                  <GlassButton variant="glass" size="lg">
                    <span>Відкрити на Audius</span>
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </GlassButton>
                </a>
              </div>
            </div>
          </GlassCard>
        ) : (
          <GlassCard radius="xl" className="p-6 sm:p-8 space-y-2">
            <h1 id="hero-heading" className="text-3xl font-bold tracking-tight">
              Хвиля — Музика у стилі Liquid Glass
            </h1>
            <p className="text-sm sm:text-base text-[var(--text-secondary)]">
              Відкривайте нові треки з Audius без реклами та зайвого шуму.
            </p>
          </GlassCard>
        )}
      </section>

      {/* Жанри */}
      <section aria-labelledby="genres-heading" className="space-y-3">
        <h2
          id="genres-heading"
          className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--text-primary)]"
        >
          Жанри
        </h2>

        <div
          role="group"
          aria-label="Фільтр за жанром"
          className="horizontal-scroller"
        >
          {AUDIUS_GENRES.map((genre) => {
            const active = selectedGenre === genre.value;
            return (
              <GlassButton
                key={genre.label}
                variant={active ? 'primary' : 'glass'}
                size="sm"
                aria-pressed={active}
                className="shrink-0 whitespace-nowrap"
                onClick={() => setSelectedGenre(genre.value)}
              >
                {genre.label}
              </GlassButton>
            );
          })}
        </div>
      </section>

      {/* У тренді */}
      <section aria-labelledby="trending-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2
            id="trending-heading"
            className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--text-primary)]"
          >
            У тренді{selectedGenre ? ` · ${activeGenreLabel}` : ''}
          </h2>

          <GlassButton
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            aria-label="Оновити трендові треки"
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? 'motion-safe:animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">Оновити</span>
          </GlassButton>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={handleRetry} />
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <TrackCardSkeleton key={idx} />
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <EmptyState
            title="Треків у цьому жанрі поки не знайдено"
            description="Спробуйте обрати інший жанр або оновити добірку."
            action={
              selectedGenre ? (
                <GlassButton variant="glass" size="sm" onClick={() => setSelectedGenre('')}>
                  Показати всі жанри
                </GlassButton>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {tracks.map((track, idx) => (
              <TrackCard
                key={track.id}
                track={track}
                priority={idx < 2}
                isActive={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                onPlay={(selected) => playTrack(selected, tracks)}
                onPlayNext={handlePlayNext}
                onAddToQueue={handleAddToQueue}
              />
            ))}
          </div>
        )}
      </section>

      {/* Нещодавно слухали */}
      <section aria-labelledby="recent-heading" className="space-y-4">
        <h2
          id="recent-heading"
          className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--text-primary)]"
        >
          Нещодавно слухали
        </h2>

        {recentlyPlayed.length > 0 ? (
          <div className="horizontal-scroller">
            {recentlyPlayed.slice(0, 12).map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                isActive={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                onPlay={(selected) => playTrack(selected, recentlyPlayed)}
                onPlayNext={handlePlayNext}
                onAddToQueue={handleAddToQueue}
                className="w-[210px] sm:w-[230px] shrink-0"
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Clock className="h-5 w-5" aria-hidden="true" />}
            title="Історія прослуховувань порожня"
            description="Щойно ви почнете слухати треки, вони з’являться тут для швидкого повернення."
          />
        )}
      </section>

      <StageNotice message={notice} />
    </div>
  );
}
