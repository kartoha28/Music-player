import { ArrowLeft, BadgeCheck, ExternalLink, Music2, Play, Shuffle, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';
import {
  EmptyState,
  ErrorState,
  HeroSkeleton,
  StageNotice,
  TrackRowSkeleton,
} from '../components/Skeleton';
import { TrackRow } from '../components/TrackRow';
import { getDefaultProvider, type Artist as ArtistType, type Track } from '../providers';
import { selectCurrentTrack, usePlayerStore } from '../store/playerStore';
import { formatCountWithUnit, handleArtworkError } from '../utils/format';

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

export default function Artist() {
  const { id } = useParams<{ id: string }>();

  const [artist, setArtist] = useState<ArtistType | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState<number>(0);
  const [notice, setNotice] = useState<string | null>(null);

  const currentTrack = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const playNext = usePlayerStore((s) => s.playNext);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const isShuffled = usePlayerStore((s) => s.isShuffled);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const artistId = id?.trim();
    if (!artistId) {
      setIsLoading(false);
      setError('Некоректний ідентифікатор артиста.');
      return;
    }

    const controller = new AbortController();
    const provider = getDefaultProvider();
    setIsLoading(true);
    setError(null);

    const loadArtist = async () => {
      try {
        const [artistMeta, artistTracks] = await Promise.all([
          provider.getArtist(artistId, controller.signal),
          provider.getArtistTracks(artistId, controller.signal),
        ]);

        if (controller.signal.aborted) return;
        setArtist(artistMeta);
        setTracks(artistTracks);
      } catch (err) {
        if (isAbortError(err)) return;
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Не вдалося завантажити профіль артиста.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadArtist();

    return () => {
      controller.abort();
    };
  }, [id, reloadTick]);

  const handleRetry = () => {
    getDefaultProvider().clearCache?.();
    setReloadTick((tick) => tick + 1);
  };

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    playTrack(tracks[0], tracks);
  };

  const handleShufflePlay = () => {
    if (tracks.length === 0) return;
    if (!isShuffled) {
      toggleShuffle();
    }
    const randomIndex = Math.floor(Math.random() * tracks.length);
    playTrack(tracks[randomIndex], tracks);
  };

  const handlePlayNext = (track: Track) => {
    playNext(track);
    setNotice(`«${track.title}» гратиме наступним.`);
  };

  const handleAddToQueue = (track: Track) => {
    addToQueue(track);
    setNotice(`«${track.title}» додано в чергу.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="inline-block no-underline">
          <GlassButton variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>На головну</span>
          </GlassButton>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <HeroSkeleton />
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, idx) => (
              <TrackRowSkeleton key={idx} />
            ))}
          </div>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={handleRetry} />
      ) : !artist ? (
        <EmptyState
          icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
          title="Артиста не знайдено"
          description="Профіль недоступний або був видалений з каталогу Audius."
          action={
            <Link to="/search" className="no-underline">
              <GlassButton variant="primary" size="md">
                Перейти до пошуку
              </GlassButton>
            </Link>
          }
        />
      ) : (
        <>
          <GlassCard as="section" radius="xl" refract className="overflow-hidden">
            {artist.coverUrl && (
              <div className="relative h-36 sm:h-48 w-full overflow-hidden">
                <img
                  src={artist.coverUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="eager"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{ background: 'var(--scrim-bottom)' }}
                />
              </div>
            )}

            <div className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              <img
                key={artist.id}
                src={artist.avatarUrl}
                alt={`Аватар артиста ${artist.name}`}
                width={136}
                height={136}
                loading="eager"
                onError={(event) => handleArtworkError(event, artist.avatarMirrors)}
                className="h-28 w-28 sm:h-32 sm:w-32 shrink-0 rounded-full object-cover border-2 border-[var(--glass-border)] bg-[var(--bg-elevated)] shadow-xl"
              />

              <div className="min-w-0 flex-1 space-y-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="m-0 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                      {artist.name}
                    </h1>
                    {artist.isVerified && (
                      <BadgeCheck
                        className="h-5 w-5 text-[var(--accent)]"
                        aria-label="Підтверджений артист"
                      />
                    )}
                  </div>

                  <p className="m-0 text-sm text-[var(--text-muted)]">@{artist.handle}</p>
                </div>

                {artist.bio && (
                  <p className="m-0 text-sm leading-relaxed text-[var(--text-secondary)] max-w-2xl line-clamp-3">
                    {artist.bio}
                  </p>
                )}

                <p className="m-0 text-xs sm:text-sm font-medium text-[var(--text-secondary)]">
                  {formatCountWithUnit(
                    artist.followerCount,
                    'підписник',
                    'підписники',
                    'підписників',
                  )}
                  {' · '}
                  {formatCountWithUnit(
                    tracks.length || artist.trackCount,
                    'трек',
                    'треки',
                    'треків',
                  )}
                </p>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <GlassButton
                    variant="primary"
                    size="md"
                    disabled={tracks.length === 0}
                    onClick={handlePlayAll}
                  >
                    <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                    <span>Грати все</span>
                  </GlassButton>

                  <GlassButton
                    variant="glass"
                    size="md"
                    disabled={tracks.length < 2}
                    onClick={handleShufflePlay}
                  >
                    <Shuffle className="h-4 w-4" aria-hidden="true" />
                    <span>Перемішати</span>
                  </GlassButton>

                  <a
                    href={artist.permalinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-underline"
                  >
                    <GlassButton variant="glass" size="md">
                      <span>Audius</span>
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </GlassButton>
                  </a>
                </div>
              </div>
            </div>
          </GlassCard>

          <section aria-labelledby="artist-tracks-heading" className="space-y-4">
            <h2
              id="artist-tracks-heading"
              className="text-xl font-semibold tracking-tight text-[var(--text-primary)]"
            >
              Треки ({tracks.length})
            </h2>

            {tracks.length === 0 ? (
              <EmptyState
                icon={<Music2 className="h-5 w-5" aria-hidden="true" />}
                title="Опублікованих треків немає"
                description="У цього артиста поки немає доступних для стрімінгу треків."
              />
            ) : (
              <div className="space-y-2.5">
                {tracks.map((track, idx) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={idx}
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
        </>
      )}

      <StageNotice message={notice} />
    </div>
  );
}
