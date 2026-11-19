import { FolderPlus, Headphones, Heart, ListPlus, ListStart, Pause, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Track } from '../providers/types';
import { useLibraryStore } from '../store/libraryStore';
import { formatCount, formatDuration, handleArtworkError } from '../utils/format';

export interface TrackRowProps {
  track: Track;
  index?: number;
  onPlay?: (track: Track) => void;
  onPlayNext?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  isActive?: boolean;
  isPlaying?: boolean;
  actions?: ReactNode;
}

const SOURCE_LABELS: Record<Track['source'], string> = {
  audius: 'Audius',
  soundcloud: 'SoundCloud',
  spotify: 'Spotify',
  jamendo: 'Jamendo',
};

export function TrackRow({
  track,
  index,
  onPlay,
  onPlayNext,
  onAddToQueue,
  isActive = false,
  isPlaying = false,
  actions,
}: TrackRowProps) {
  const showPause = isActive && isPlaying;
  const isLiked = useLibraryStore((s) => s.likedTracks.some((item) => item.id === track.id));
  const toggleLike = useLibraryStore((s) => s.toggleLike);
  const openPlaylistPicker = useLibraryStore((s) => s.openPlaylistPicker);

  return (
    <div
      className={[
        'group glass-card glass-interactive glass-radius-md px-3 py-2.5 sm:px-4 flex items-center gap-3 sm:gap-4',
        isActive ? 'ring-1 ring-[var(--accent)] bg-[var(--glass-bg-active)]' : '',
      ].join(' ')}
    >
      {index !== undefined && (
        <span className="hidden sm:inline-flex w-6 justify-center text-xs font-medium text-[var(--text-muted)] tabular-nums shrink-0">
          {index + 1}
        </span>
      )}

      <button
        type="button"
        onClick={() => onPlay?.(track)}
        aria-label={
          showPause
            ? `Призупинити ${track.title}`
            : `Відтворити ${track.title} — ${track.artist}`
        }
        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-elevated)] cursor-pointer border-0 p-0"
      >
        <img
          key={track.id}
          src={track.artworkThumbnailUrl || track.artworkUrl}
          alt={`Обкладинка ${track.title}`}
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
          onError={(event) => handleArtworkError(event, track.artworkMirrors)}
          className="h-full w-full object-cover"
        />
        <span
          className={[
            'absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity duration-150',
            isActive
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
          ].join(' ')}
        >
          {showPause ? (
            <Pause className="h-4 w-4 fill-current" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4 fill-current translate-x-0.5" aria-hidden="true" />
          )}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onPlay?.(track)}
          className={`block w-full text-left text-sm font-semibold truncate hover:text-[var(--accent)] transition-colors cursor-pointer bg-transparent border-0 p-0 ${
            isActive ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
          }`}
          title={track.title}
        >
          {track.title}
        </button>

        <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-secondary)] min-w-0">
          {track.artistId ? (
            <Link
              to={`/artist/${encodeURIComponent(track.artistId)}`}
              className="truncate text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline hover:underline"
            >
              {track.artist}
            </Link>
          ) : (
            <span className="truncate">{track.artist}</span>
          )}

          {track.genre && (
            <>
              <span aria-hidden="true" className="text-[var(--text-muted)]">
                ·
              </span>
              <span className="hidden md:inline truncate text-[var(--text-muted)]">
                {track.genre}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {track.playCount !== undefined && (
          <span className="hidden lg:inline-flex items-center gap-1 text-xs text-[var(--text-muted)] tabular-nums mr-1">
            <Headphones className="h-3.5 w-3.5" aria-hidden="true" />
            {formatCount(track.playCount)}
          </span>
        )}

        <span className="hidden md:inline-flex rounded-full border border-[var(--glass-border-subtle)] bg-[var(--glass-bg)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
          {SOURCE_LABELS[track.source]}
        </span>

        <span className="text-xs font-medium text-[var(--text-secondary)] tabular-nums min-w-[2.5rem] text-right mr-1">
          {formatDuration(track.duration)}
        </span>

        <button
          type="button"
          onClick={() => toggleLike(track)}
          aria-pressed={isLiked}
          title={isLiked ? 'Прибрати з вподобаних' : 'Вподобати'}
          aria-label={isLiked ? `Прибрати лайк: ${track.title}` : `Вподобати: ${track.title}`}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors cursor-pointer bg-transparent border-0 ${
            isLiked
              ? 'text-[var(--accent)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => openPlaylistPicker(track)}
          title="Додати у плейлист"
          aria-label={`Додати у плейлист: ${track.title}`}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] hover:text-[var(--text-primary)] transition-colors cursor-pointer bg-transparent border-0"
        >
          <FolderPlus className="h-4 w-4" aria-hidden="true" />
        </button>

        {onPlayNext && (
          <button
            type="button"
            onClick={() => onPlayNext(track)}
            title="Грати наступним"
            aria-label={`Грати наступним: ${track.title}`}
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] hover:text-[var(--text-primary)] transition-colors cursor-pointer bg-transparent border-0"
          >
            <ListStart className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        {onAddToQueue && (
          <button
            type="button"
            onClick={() => onAddToQueue(track)}
            title="Додати в чергу"
            aria-label={`Додати в чергу: ${track.title}`}
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] hover:text-[var(--text-primary)] transition-colors cursor-pointer bg-transparent border-0"
          >
            <ListPlus className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
    </div>
  );
}
