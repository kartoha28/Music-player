import { FolderPlus, Headphones, Heart, ListPlus, ListStart, Pause, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Track } from '../providers/types';
import { useLibraryStore } from '../store/libraryStore';
import { formatCount, formatDuration, handleArtworkError } from '../utils/format';
import { GlassCard } from './GlassCard';

export interface TrackCardProps {
  track: Track;
  onPlay?: (track: Track) => void;
  onPlayNext?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  isActive?: boolean;
  isPlaying?: boolean;
  priority?: boolean;
  className?: string;
}

export function TrackCard({
  track,
  onPlay,
  onPlayNext,
  onAddToQueue,
  isActive = false,
  isPlaying = false,
  priority = false,
  className = '',
}: TrackCardProps) {
  const showPause = isActive && isPlaying;
  const isLiked = useLibraryStore((s) => s.likedTracks.some((item) => item.id === track.id));
  const toggleLike = useLibraryStore((s) => s.toggleLike);
  const openPlaylistPicker = useLibraryStore((s) => s.openPlaylistPicker);

  return (
    <GlassCard
      as="article"
      interactive
      spotlight
      radius="md"
      className={`group p-3.5 flex flex-col gap-3 ${
        isActive ? 'ring-1 ring-[var(--accent)]' : ''
      } ${className}`}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[var(--bg-elevated)]">
        <img
          key={track.id}
          src={track.artworkUrl}
          alt={`Обкладинка треку ${track.title}`}
          width={480}
          height={480}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
          onError={(event) => handleArtworkError(event, track.artworkMirrors)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />

        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity duration-150">
            <button
              type="button"
              onClick={() => toggleLike(track)}
              aria-pressed={isLiked}
              title={isLiked ? 'Прибрати з вподобаних' : 'Додати у вподобані'}
              aria-label={isLiked ? `Прибрати лайк: ${track.title}` : `Вподобати: ${track.title}`}
              className={`flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-md transition-colors cursor-pointer ${
                isLiked
                  ? 'bg-[var(--accent)] border-white/40 text-[var(--accent-contrast)]'
                  : 'bg-black/60 border-white/25 text-white hover:bg-[var(--accent)]'
              }`}
            >
              <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => openPlaylistPicker(track)}
              title="Додати у плейлист"
              aria-label={`Додати у плейлист: ${track.title}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white border border-white/25 backdrop-blur-md hover:bg-[var(--accent)] transition-colors cursor-pointer"
            >
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {(onPlayNext || onAddToQueue) && (
            <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity duration-150">
              {onPlayNext && (
                <button
                  type="button"
                  onClick={() => onPlayNext(track)}
                  title="Грати наступним"
                  aria-label={`Грати наступним: ${track.title}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white border border-white/25 backdrop-blur-md hover:bg-[var(--accent)] transition-colors cursor-pointer"
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
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white border border-white/25 backdrop-blur-md hover:bg-[var(--accent)] transition-colors cursor-pointer"
                >
                  <ListPlus className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20 opacity-85"
          style={{ background: 'var(--scrim-bottom)' }}
        />

        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
          <span className="rounded-full bg-black/55 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-md tabular-nums">
            {formatDuration(track.duration)}
          </span>

          <button
            type="button"
            onClick={() => onPlay?.(track)}
            aria-label={
              showPause
                ? `Призупинити ${track.title}`
                : `Відтворити ${track.title} — ${track.artist}`
            }
            className={[
              'flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] shadow-lg border border-white/30 cursor-pointer',
              'transition-all duration-200 hover:scale-105 active:scale-95',
              isActive
                ? 'opacity-100 translate-y-0'
                : 'opacity-100 sm:opacity-0 sm:translate-y-1 sm:group-hover:opacity-100 sm:group-hover:translate-y-0 sm:group-focus-within:opacity-100 sm:group-focus-within:translate-y-0',
            ].join(' ')}
          >
            {showPause ? (
              <Pause className="h-5 w-5 fill-current" aria-hidden="true" />
            ) : (
              <Play className="h-5 w-5 fill-current translate-x-0.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div className="min-w-0 space-y-1 px-0.5">
        <button
          type="button"
          onClick={() => onPlay?.(track)}
          className="block w-full text-left text-sm sm:text-[15px] font-semibold leading-snug text-[var(--text-primary)] truncate hover:text-[var(--accent)] transition-colors cursor-pointer bg-transparent border-0 p-0"
          title={track.title}
        >
          {track.title}
        </button>

        <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
          {track.artistId ? (
            <Link
              to={`/artist/${encodeURIComponent(track.artistId)}`}
              className="truncate text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline hover:underline"
              title={track.artist}
            >
              {track.artist}
            </Link>
          ) : (
            <span className="truncate">{track.artist}</span>
          )}

          {track.playCount !== undefined ? (
            <span className="inline-flex items-center gap-1 shrink-0 text-[11px] text-[var(--text-muted)] tabular-nums">
              <Headphones className="h-3 w-3" aria-hidden="true" />
              {formatCount(track.playCount)}
            </span>
          ) : track.genre ? (
            <span className="shrink-0 truncate max-w-[90px] text-[11px] text-[var(--text-muted)]">
              {track.genre}
            </span>
          ) : null}
        </div>
      </div>
    </GlassCard>
  );
}
