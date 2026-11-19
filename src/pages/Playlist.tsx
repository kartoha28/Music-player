import {
  ArrowLeft,
  Check,
  Clock,
  Disc3,
  ExternalLink,
  Pencil,
  Play,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
import { getDefaultProvider, type Playlist as RemotePlaylist, type Track } from '../providers';
import { useLibraryStore } from '../store/libraryStore';
import { selectCurrentTrack, usePlayerStore } from '../store/playerStore';
import {
  FALLBACK_ARTWORK_SVG,
  formatCountWithUnit,
  formatDuration,
  handleArtworkError,
} from '../utils/format';

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

export default function Playlist() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const isLocal = Boolean(id?.startsWith('local-'));
  const localPlaylist = useLibraryStore((s) =>
    isLocal ? s.playlists.find((pl) => pl.id === id) ?? null : null,
  );
  const renamePlaylist = useLibraryStore((s) => s.renamePlaylist);
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist);
  const removeTrackFromPlaylist = useLibraryStore((s) => s.removeTrackFromPlaylist);

  const [remotePlaylist, setRemotePlaylist] = useState<RemotePlaylist | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!isLocal);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState<number>(0);
  const [notice, setNotice] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const currentTrack = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const playNext = usePlayerStore((s) => s.playNext);
  const addToQueue = usePlayerStore((s) => s.addToQueue);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    setIsEditing(false);
    setConfirmDelete(false);
  }, [id]);

  useEffect(() => {
    if (isLocal) {
      setIsLoading(false);
      setError(null);
      return;
    }

    const playlistId = id?.trim();
    if (!playlistId) {
      setIsLoading(false);
      setError('Некоректний ідентифікатор плейлиста.');
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    const loadPlaylist = async () => {
      try {
        const data = await getDefaultProvider().getPlaylist(playlistId, controller.signal);
        if (controller.signal.aborted) return;
        setRemotePlaylist(data);
      } catch (err) {
        if (isAbortError(err)) return;
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Не вдалося завантажити плейлист.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadPlaylist();

    return () => {
      controller.abort();
    };
  }, [id, isLocal, reloadTick]);

  const tracks: Track[] = useMemo(() => {
    if (isLocal) return localPlaylist?.tracks ?? [];
    return remotePlaylist?.tracks ?? [];
  }, [isLocal, localPlaylist, remotePlaylist]);

  const totalDuration = useMemo(
    () => tracks.reduce((sum, item) => sum + (item.duration || 0), 0),
    [tracks],
  );

  const handleRetry = () => {
    getDefaultProvider().clearCache?.();
    setReloadTick((tick) => tick + 1);
  };

  const handleStartEdit = () => {
    if (!localPlaylist) return;
    setEditTitle(localPlaylist.title);
    setEditDescription(localPlaylist.description);
    setIsEditing(true);
  };

  const handleSaveEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!localPlaylist || !editTitle.trim()) return;
    renamePlaylist(localPlaylist.id, editTitle, editDescription);
    setIsEditing(false);
    setNotice('Назву плейлиста оновлено.');
  };

  const handleDeletePlaylist = () => {
    if (!localPlaylist) return;
    deletePlaylist(localPlaylist.id);
    navigate('/library', { replace: true });
  };

  const handlePlayNext = (track: Track) => {
    playNext(track);
    setNotice(`«${track.title}» гратиме наступним.`);
  };

  const handleAddToQueue = (track: Track) => {
    addToQueue(track);
    setNotice(`«${track.title}» додано в чергу.`);
  };

  const displayTitle = isLocal ? localPlaylist?.title : remotePlaylist?.title;
  const displayDescription = isLocal ? localPlaylist?.description : remotePlaylist?.description;
  const displayArtwork = isLocal
    ? localPlaylist?.tracks[0]?.artworkUrl ?? FALLBACK_ARTWORK_SVG
    : remotePlaylist?.artworkUrl ?? FALLBACK_ARTWORK_SVG;
  const displayMirrors = isLocal
    ? localPlaylist?.tracks[0]?.artworkMirrors
    : remotePlaylist?.artworkMirrors;

  const missingPlaylist = isLocal ? !localPlaylist : !remotePlaylist;

  return (
    <div className="space-y-6">
      <div>
        <Link to={isLocal ? '/library' : '/'} className="inline-block no-underline">
          <GlassButton variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>{isLocal ? 'До бібліотеки' : 'На головну'}</span>
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
      ) : missingPlaylist ? (
        <EmptyState
          icon={<Disc3 className="h-5 w-5" aria-hidden="true" />}
          title="Плейлист не знайдено"
          description={
            isLocal
              ? 'Цей локальний плейлист був видалений або не існує.'
              : 'Плейлист недоступний або видалений з Audius.'
          }
          action={
            <Link to={isLocal ? '/library' : '/search'} className="no-underline">
              <GlassButton variant="primary" size="md">
                {isLocal ? 'До бібліотеки' : 'Пошук музики'}
              </GlassButton>
            </Link>
          }
        />
      ) : (
        <>
          <GlassCard
            as="section"
            radius="xl"
            refract
            className="p-6 sm:p-8 flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center"
          >
            <div className="w-44 sm:w-52 aspect-square shrink-0 overflow-hidden rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-elevated)] shadow-2xl">
              {isLocal && localPlaylist && localPlaylist.tracks.length >= 4 ? (
                <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
                  {localPlaylist.tracks.slice(0, 4).map((t) => (
                    <img
                      key={t.id}
                      src={t.artworkThumbnailUrl || t.artworkUrl}
                      alt=""
                      onError={(event) => handleArtworkError(event, t.artworkMirrors)}
                      className="h-full w-full object-cover"
                    />
                  ))}
                </div>
              ) : (
                <img
                  key={id}
                  src={displayArtwork}
                  alt={`Обкладинка плейлиста ${displayTitle ?? ''}`}
                  width={260}
                  height={260}
                  onError={(event) => handleArtworkError(event, displayMirrors)}
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                <Disc3 className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
                {isLocal
                  ? 'Власний плейлист'
                  : remotePlaylist?.isAlbum
                    ? 'Альбом'
                    : 'Плейлист Audius'}
              </span>

              {isEditing ? (
                <form onSubmit={handleSaveEdit} className="space-y-3 max-w-lg">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    placeholder="Назва плейлиста"
                    aria-label="Назва плейлиста"
                    maxLength={80}
                    className="w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2 text-base font-semibold text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    placeholder="Короткий опис (необов’язково)"
                    aria-label="Опис плейлиста"
                    maxLength={160}
                    className="w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    <GlassButton type="submit" variant="primary" size="sm" disabled={!editTitle.trim()}>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      <span>Зберегти</span>
                    </GlassButton>
                    <GlassButton
                      variant="glass"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      <span>Скасувати</span>
                    </GlassButton>
                  </div>
                </form>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <h1 className="m-0 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                      {displayTitle}
                    </h1>

                    {!isLocal && remotePlaylist && (
                      <p className="m-0 text-sm text-[var(--text-secondary)]">
                        Автор:{' '}
                        {remotePlaylist.ownerId ? (
                          <Link
                            to={`/artist/${encodeURIComponent(remotePlaylist.ownerId)}`}
                            className="font-medium text-[var(--text-primary)] no-underline hover:underline"
                          >
                            {remotePlaylist.ownerName}
                          </Link>
                        ) : (
                          <span className="font-medium">{remotePlaylist.ownerName}</span>
                        )}
                      </p>
                    )}

                    {displayDescription && (
                      <p className="m-0 text-sm leading-relaxed text-[var(--text-secondary)] max-w-2xl">
                        {displayDescription}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-[var(--text-muted)]">
                    <span>{formatCountWithUnit(tracks.length, 'трек', 'треки', 'треків')}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {formatDuration(totalDuration)}
                    </span>
                  </div>
                </>
              )}

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <GlassButton
                  variant="primary"
                  size="md"
                  disabled={tracks.length === 0}
                  onClick={() => tracks.length > 0 && playTrack(tracks[0], tracks)}
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  <span>Грати все</span>
                </GlassButton>

                {isLocal && !isEditing && (
                  <>
                    <GlassButton variant="glass" size="md" onClick={handleStartEdit}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      <span>Перейменувати</span>
                    </GlassButton>

                    {!confirmDelete ? (
                      <GlassButton
                        variant="ghost"
                        size="md"
                        onClick={() => setConfirmDelete(true)}
                      >
                        <Trash2 className="h-4 w-4 text-rose-400" aria-hidden="true" />
                        <span>Видалити</span>
                      </GlassButton>
                    ) : (
                      <div className="flex items-center gap-2">
                        <GlassButton
                          variant="glass"
                          size="sm"
                          className="border-rose-500/50 bg-rose-500/20 text-[var(--text-primary)]"
                          onClick={handleDeletePlaylist}
                        >
                          Підтвердити видалення
                        </GlassButton>
                        <GlassButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(false)}
                        >
                          Скасувати
                        </GlassButton>
                      </div>
                    )}
                  </>
                )}

                {!isLocal && remotePlaylist?.permalinkUrl && (
                  <a
                    href={remotePlaylist.permalinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-underline"
                  >
                    <GlassButton variant="glass" size="md">
                      <span>Audius</span>
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </GlassButton>
                  </a>
                )}
              </div>
            </div>
          </GlassCard>

          <section aria-labelledby="playlist-tracks-heading" className="space-y-4">
            <h2
              id="playlist-tracks-heading"
              className="text-xl font-semibold tracking-tight text-[var(--text-primary)]"
            >
              Треки ({tracks.length})
            </h2>

            {tracks.length === 0 ? (
              <EmptyState
                icon={<Disc3 className="h-5 w-5" aria-hidden="true" />}
                title="У цьому плейлисті ще немає треків"
                description="Натисніть іконку папки з плюсом на будь-якому треку, щоб додати його сюди."
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
                    actions={
                      isLocal && localPlaylist ? (
                        <button
                          type="button"
                          onClick={() => {
                            removeTrackFromPlaylist(localPlaylist.id, track.id);
                            setNotice(`«${track.title}» видалено з плейлиста.`);
                          }}
                          title="Видалити з плейлиста"
                          aria-label={`Видалити ${track.title} з плейлиста`}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--glass-bg)] hover:text-rose-400 transition-colors cursor-pointer bg-transparent border-0"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      ) : undefined
                    }
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
