import { BadgeCheck, Disc3, Music2, Search as SearchIcon, Sparkles, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';
import { SearchBar } from '../components/SearchBar';
import {
  EmptyState,
  ErrorState,
  StageNotice,
  TrackCardSkeleton,
  TrackRowSkeleton,
} from '../components/Skeleton';
import { TrackRow } from '../components/TrackRow';
import { useDebounce } from '../hooks/useDebounce';
import { getDefaultProvider, type SearchResults, type Track } from '../providers';
import { formatCountWithUnit, handleArtworkError } from '../utils/format';

type SearchTab = 'tracks' | 'artists' | 'playlists';

const QUICK_SUGGESTIONS = [
  'Electronic',
  'Ambient',
  'Synthwave',
  'House',
  'Drum & Bass',
  'Jazz',
  'Hip-Hop',
] as const;

const EMPTY_RESULTS: SearchResults = {
  tracks: [],
  artists: [],
  playlists: [],
};

function parseTab(raw: string | null): SearchTab {
  if (raw === 'artists' || raw === 'playlists') return raw;
  return 'tracks';
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const activeTab = parseTab(searchParams.get('tab'));

  const [query, setQuery] = useState<string>(initialQuery);
  const debouncedQuery = useDebounce(query, 300);

  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState<number>(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    const currentUrlQ = searchParams.get('q') ?? '';

    if (trimmed !== currentUrlQ) {
      const next = new URLSearchParams(searchParams);
      if (trimmed) {
        next.set('q', trimmed);
      } else {
        next.delete('q');
      }
      setSearchParams(next, { replace: true });
    }
  }, [debouncedQuery, searchParams, setSearchParams]);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setResults(EMPTY_RESULTS);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    const runSearch = async () => {
      try {
        const data = await getDefaultProvider().search(trimmed, controller.signal);
        if (controller.signal.aborted) return;
        setResults(data);
      } catch (err) {
        if (isAbortError(err)) return;
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Не вдалося виконати пошук. Перевірте підключення до мережі.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void runSearch();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, retryTick]);

  const setTab = (tab: SearchTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const handleRetry = () => {
    getDefaultProvider().clearCache?.();
    setRetryTick((tick) => tick + 1);
  };

  const handlePlayPreview = (track: Track) => {
    setNotice(`«${track.title}» — відтворення в плеєрі буде підключено на Етапі 3.`);
  };

  const trimmedDebounced = debouncedQuery.trim();

  const tabs: Array<{ id: SearchTab; label: string; count: number }> = [
    { id: 'tracks', label: 'Треки', count: results.tracks.length },
    { id: 'artists', label: 'Артисти', count: results.artists.length },
    { id: 'playlists', label: 'Плейлисти', count: results.playlists.length },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Пошук</h1>
        <p className="text-sm sm:text-base text-[var(--text-secondary)]">
          Миттєвий пошук треків, артистів і плейлистів у каталозі Audius.
        </p>
      </header>

      <SearchBar value={query} onChange={setQuery} isLoading={isLoading} />

      {!trimmedDebounced ? (
        <GlassCard radius="xl" className="p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2.5 text-[var(--text-primary)]">
            <Sparkles className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Швидкі підказки для пошуку</h2>
          </div>

          <p className="text-sm text-[var(--text-secondary)]">
            Введіть назву треку, псевдонім артиста або оберіть один із популярних напрямків:
          </p>

          <div className="flex flex-wrap gap-2.5">
            {QUICK_SUGGESTIONS.map((suggestion) => (
              <GlassButton
                key={suggestion}
                variant="glass"
                size="sm"
                onClick={() => setQuery(suggestion)}
              >
                <SearchIcon className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
                <span>{suggestion}</span>
              </GlassButton>
            ))}
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-5">
          {/* Вкладки результатів */}
          <div
            role="tablist"
            aria-label="Категорії результатів пошуку"
            className="flex flex-wrap gap-2"
          >
            {tabs.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <GlassButton
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`panel-${tab.id}`}
                  variant={selected ? 'primary' : 'glass'}
                  size="md"
                  onClick={() => setTab(tab.id)}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                      selected ? 'bg-white/20 text-white' : 'bg-[var(--glass-bg)] text-[var(--text-muted)]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </GlassButton>
              );
            })}
          </div>

          {/* Контент активної вкладки */}
          {error ? (
            <ErrorState message={error} onRetry={handleRetry} />
          ) : isLoading ? (
            activeTab === 'tracks' ? (
              <div className="space-y-2.5" aria-busy="true" aria-label="Пошук треків">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <TrackRowSkeleton key={idx} />
                ))}
              </div>
            ) : (
              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                aria-busy="true"
                aria-label="Пошук результатів"
              >
                {Array.from({ length: 6 }).map((_, idx) => (
                  <TrackCardSkeleton key={idx} />
                ))}
              </div>
            )
          ) : (
            <div
              id={`panel-${activeTab}`}
              role="tabpanel"
              aria-labelledby={`tab-${activeTab}`}
            >
              {activeTab === 'tracks' &&
                (results.tracks.length === 0 ? (
                  <EmptyState
                    icon={<Music2 className="h-5 w-5" aria-hidden="true" />}
                    title="Треки не знайдено"
                    description={`За запитом «${trimmedDebounced}» не знайдено жодного доступного треку. Спробуйте інші ключові слова.`}
                  />
                ) : (
                  <div className="space-y-2.5">
                    {results.tracks.map((track, index) => (
                      <TrackRow
                        key={track.id}
                        track={track}
                        index={index}
                        onPlay={handlePlayPreview}
                      />
                    ))}
                  </div>
                ))}

              {activeTab === 'artists' &&
                (results.artists.length === 0 ? (
                  <EmptyState
                    icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
                    title="Артистів не знайдено"
                    description={`За запитом «${trimmedDebounced}» не знайдено профілів артистів.`}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {results.artists.map((artist) => (
                      <Link
                        key={artist.id}
                        to={`/artist/${encodeURIComponent(artist.id)}`}
                        className="no-underline block group"
                      >
                        <GlassCard
                          interactive
                          spotlight
                          radius="md"
                          className="h-full p-5 flex flex-col items-center text-center gap-3"
                        >
                          <img
                            src={artist.avatarUrl}
                            alt={`Аватар артиста ${artist.name}`}
                            width={112}
                            height={112}
                            loading="lazy"
                            decoding="async"
                            onError={(event) => handleArtworkError(event, artist.avatarMirrors)}
                            className="h-24 w-24 rounded-full object-cover border border-[var(--glass-border)] bg-[var(--bg-elevated)] transition-transform duration-300 group-hover:scale-105"
                          />

                          <div className="min-w-0 w-full space-y-1">
                            <div className="flex items-center justify-center gap-1.5">
                              <h3 className="text-base font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                                {artist.name}
                              </h3>
                              {artist.isVerified && (
                                <BadgeCheck
                                  className="h-4 w-4 shrink-0 text-[var(--accent)]"
                                  aria-label="Підтверджений артист"
                                />
                              )}
                            </div>

                            <p className="text-xs text-[var(--text-muted)] truncate">
                              @{artist.handle}
                            </p>

                            <p className="text-xs text-[var(--text-secondary)] pt-1">
                              {formatCountWithUnit(
                                artist.followerCount,
                                'підписник',
                                'підписники',
                                'підписників',
                              )}
                              {artist.trackCount !== undefined &&
                                ` · ${formatCountWithUnit(
                                  artist.trackCount,
                                  'трек',
                                  'треки',
                                  'треків',
                                )}`}
                            </p>
                          </div>
                        </GlassCard>
                      </Link>
                    ))}
                  </div>
                ))}

              {activeTab === 'playlists' &&
                (results.playlists.length === 0 ? (
                  <EmptyState
                    icon={<Disc3 className="h-5 w-5" aria-hidden="true" />}
                    title="Плейлисти не знайдено"
                    description={`За запитом «${trimmedDebounced}» не знайдено жодного плейлиста.`}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {results.playlists.map((playlist) => (
                      <Link
                        key={playlist.id}
                        to={`/playlist/${encodeURIComponent(playlist.id)}`}
                        className="no-underline block group"
                      >
                        <GlassCard
                          interactive
                          spotlight
                          radius="md"
                          className="h-full p-3.5 flex flex-col gap-3"
                        >
                          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[var(--bg-elevated)]">
                            <img
                              src={playlist.artworkUrl}
                              alt={`Обкладинка плейлиста ${playlist.title}`}
                              width={480}
                              height={480}
                              loading="lazy"
                              decoding="async"
                              onError={(event) => handleArtworkError(event, playlist.artworkMirrors)}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            />
                            <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-md">
                              {formatCountWithUnit(
                                playlist.trackCount,
                                'трек',
                                'треки',
                                'треків',
                              )}
                            </span>
                          </div>

                          <div className="min-w-0 space-y-1 px-0.5">
                            <h3 className="text-sm sm:text-[15px] font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                              {playlist.title}
                            </h3>
                            <p className="text-xs text-[var(--text-secondary)] truncate">
                              {playlist.isAlbum ? 'Альбом · ' : ''}
                              {playlist.ownerName}
                            </p>
                          </div>
                        </GlassCard>
                      </Link>
                    ))}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <StageNotice message={notice} />
    </div>
  );
}
