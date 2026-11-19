import { Check, Disc3, Heart, ListMusic, Pencil, Play, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';
import { EmptyState, StageNotice } from '../components/Skeleton';
import { TrackRow } from '../components/TrackRow';
import type { Track } from '../providers';
import { useLibraryStore } from '../store/libraryStore';
import { selectCurrentTrack, usePlayerStore } from '../store/playerStore';
import {
  FALLBACK_ARTWORK_SVG,
  formatCountWithUnit,
  handleArtworkError,
} from '../utils/format';

type LibraryTab = 'likes' | 'playlists';

export default function Library() {
  const [activeTab, setActiveTab] = useState<LibraryTab>('likes');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const likedTracks = useLibraryStore((s) => s.likedTracks);
  const playlists = useLibraryStore((s) => s.playlists);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const renamePlaylist = useLibraryStore((s) => s.renamePlaylist);
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist);

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

  const handleCreatePlaylist = (event: FormEvent) => {
    event.preventDefault();
    const clean = newTitle.trim();
    if (!clean) return;
    const created = createPlaylist(clean, newDescription);
    setNewTitle('');
    setNewDescription('');
    setNotice(`Плейлист «${created.title}» створено.`);
  };

  const handleSaveRename = (event: FormEvent, id: string) => {
    event.preventDefault();
    if (!editTitle.trim()) return;
    renamePlaylist(id, editTitle, editDescription);
    setEditingId(null);
    setNotice('Плейлист оновлено.');
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
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Бібліотека
        </h1>
        <p className="text-sm sm:text-base text-[var(--text-secondary)]">
          Вподобані треки та власні плейлисти, збережені локально у вашому браузері.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Розділи бібліотеки"
        className="flex flex-wrap gap-2"
      >
        <GlassButton
          id="lib-tab-likes"
          role="tab"
          aria-selected={activeTab === 'likes'}
          aria-controls="lib-panel-likes"
          variant={activeTab === 'likes' ? 'primary' : 'glass'}
          size="md"
          onClick={() => setActiveTab('likes')}
        >
          <Heart className="h-4 w-4" aria-hidden="true" />
          <span>Вподобані треки</span>
          <span className="rounded-full px-2 py-0.5 text-xs bg-white/15 tabular-nums">
            {likedTracks.length}
          </span>
        </GlassButton>

        <GlassButton
          id="lib-tab-playlists"
          role="tab"
          aria-selected={activeTab === 'playlists'}
          aria-controls="lib-panel-playlists"
          variant={activeTab === 'playlists' ? 'primary' : 'glass'}
          size="md"
          onClick={() => setActiveTab('playlists')}
        >
          <ListMusic className="h-4 w-4" aria-hidden="true" />
          <span>Мої плейлисти</span>
          <span className="rounded-full px-2 py-0.5 text-xs bg-white/15 tabular-nums">
            {playlists.length}
          </span>
        </GlassButton>
      </div>

      {activeTab === 'likes' && (
        <section
          id="lib-panel-likes"
          role="tabpanel"
          aria-labelledby="lib-tab-likes"
          className="space-y-4"
        >
          {likedTracks.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <p className="m-0 text-sm text-[var(--text-secondary)]">
                {formatCountWithUnit(likedTracks.length, 'трек', 'треки', 'треків')}
              </p>
              <GlassButton
                variant="primary"
                size="sm"
                onClick={() => playTrack(likedTracks[0], likedTracks)}
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                <span>Грати все</span>
              </GlassButton>
            </div>
          )}

          {likedTracks.length === 0 ? (
            <EmptyState
              icon={<Heart className="h-5 w-5" aria-hidden="true" />}
              title="Поки немає вподобаних треків"
              description="Натискайте на серце на будь-якому треку або в плеєрі, щоб зібрати улюблену музику тут."
              action={
                <div className="flex flex-wrap gap-2">
                  <Link to="/" className="no-underline">
                    <GlassButton variant="primary" size="sm">
                      На головну
                    </GlassButton>
                  </Link>
                  <Link to="/search" className="no-underline">
                    <GlassButton variant="glass" size="sm">
                      Знайти треки
                    </GlassButton>
                  </Link>
                </div>
              }
            />
          ) : (
            <div className="space-y-2.5">
              {likedTracks.map((track, idx) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={idx}
                  isActive={currentTrack?.id === track.id}
                  isPlaying={isPlaying}
                  onPlay={(selected) => playTrack(selected, likedTracks)}
                  onPlayNext={handlePlayNext}
                  onAddToQueue={handleAddToQueue}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'playlists' && (
        <section
          id="lib-panel-playlists"
          role="tabpanel"
          aria-labelledby="lib-tab-playlists"
          className="space-y-6"
        >
          <GlassCard radius="xl" className="p-5 sm:p-6 space-y-3">
            <h2 className="m-0 text-base sm:text-lg font-semibold text-[var(--text-primary)]">
              Створити новий плейлист
            </h2>

            <form
              onSubmit={handleCreatePlaylist}
              className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-center"
            >
              <input
                type="text"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Назва плейлиста *"
                aria-label="Назва нового плейлиста"
                maxLength={80}
                className="w-full rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              />
              <input
                type="text"
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder="Опис (необов’язково)"
                aria-label="Опис нового плейлиста"
                maxLength={160}
                className="w-full rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              />
              <GlassButton
                type="submit"
                variant="primary"
                size="md"
                disabled={!newTitle.trim()}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Створити плейлист</span>
              </GlassButton>
            </form>
          </GlassCard>

          {playlists.length === 0 ? (
            <EmptyState
              icon={<Disc3 className="h-5 w-5" aria-hidden="true" />}
              title="Власних плейлистів ще немає"
              description="Створіть свій перший плейлист вище або додавайте треки через іконку папки."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlists.map((pl) => {
                const isEditing = editingId === pl.id;
                const isConfirmingDelete = confirmDeleteId === pl.id;
                const coverUrl = pl.tracks[0]?.artworkUrl ?? FALLBACK_ARTWORK_SVG;
                const coverMirrors = pl.tracks[0]?.artworkMirrors;

                return (
                  <GlassCard
                    key={pl.id}
                    radius="lg"
                    spotlight
                    className="p-4 flex flex-col gap-3.5"
                  >
                    <Link
                      to={`/playlist/${encodeURIComponent(pl.id)}`}
                      className="block relative aspect-square w-full overflow-hidden rounded-2xl bg-[var(--bg-elevated)] group"
                    >
                      {pl.tracks.length >= 4 ? (
                        <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
                          {pl.tracks.slice(0, 4).map((t) => (
                            <img
                              key={t.id}
                              src={t.artworkThumbnailUrl || t.artworkUrl}
                              alt=""
                              loading="lazy"
                              onError={(event) => handleArtworkError(event, t.artworkMirrors)}
                              className="h-full w-full object-cover"
                            />
                          ))}
                        </div>
                      ) : (
                        <img
                          src={coverUrl}
                          alt={`Обкладинка плейлиста ${pl.title}`}
                          loading="lazy"
                          onError={(event) => handleArtworkError(event, coverMirrors)}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      )}

                      <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-md">
                        {formatCountWithUnit(pl.tracks.length, 'трек', 'треки', 'треків')}
                      </span>
                    </Link>

                    {isEditing ? (
                      <form
                        onSubmit={(event) => handleSaveRename(event, pl.id)}
                        className="space-y-2"
                      >
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          aria-label="Нова назва плейлиста"
                          maxLength={80}
                          className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-1.5 text-sm font-semibold text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                        />
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(event) => setEditDescription(event.target.value)}
                          placeholder="Опис"
                          aria-label="Новий опис плейлиста"
                          maxLength={160}
                          className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <GlassButton
                            type="submit"
                            variant="primary"
                            size="sm"
                            disabled={!editTitle.trim()}
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Зберегти</span>
                          </GlassButton>
                          <GlassButton
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Скасувати</span>
                          </GlassButton>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-1 min-w-0">
                        <Link
                          to={`/playlist/${encodeURIComponent(pl.id)}`}
                          className="block truncate text-base font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] no-underline"
                        >
                          {pl.title}
                        </Link>
                        {pl.description ? (
                          <p className="m-0 truncate text-xs text-[var(--text-secondary)]">
                            {pl.description}
                          </p>
                        ) : (
                          <p className="m-0 text-xs text-[var(--text-muted)]">Локальна колекція</p>
                        )}
                      </div>
                    )}

                    {!isEditing && (
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--glass-border-subtle)]">
                        <GlassButton
                          variant="primary"
                          size="sm"
                          disabled={pl.tracks.length === 0}
                          onClick={() =>
                            pl.tracks.length > 0 && playTrack(pl.tracks[0], pl.tracks)
                          }
                        >
                          <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                          <span>Грати</span>
                        </GlassButton>

                        <div className="flex items-center gap-1">
                          <GlassButton
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Перейменувати ${pl.title}`}
                            title="Перейменувати"
                            onClick={() => {
                              setEditingId(pl.id);
                              setEditTitle(pl.title);
                              setEditDescription(pl.description);
                              setConfirmDeleteId(null);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </GlassButton>

                          {!isConfirmingDelete ? (
                            <GlassButton
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Видалити ${pl.title}`}
                              title="Видалити плейлист"
                              onClick={() => setConfirmDeleteId(pl.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                            </GlassButton>
                          ) : (
                            <div className="flex items-center gap-1">
                              <GlassButton
                                variant="glass"
                                size="sm"
                                className="border-rose-500/50 bg-rose-500/20 text-[var(--text-primary)]"
                                onClick={() => {
                                  deletePlaylist(pl.id);
                                  setConfirmDeleteId(null);
                                  setNotice(`Плейлист «${pl.title}» видалено.`);
                                }}
                              >
                                Видалити
                              </GlassButton>
                              <GlassButton
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                aria-label="Скасувати видалення"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                              </GlassButton>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </GlassCard>
                );
              })}
            </div>
          )}
        </section>
      )}

      <StageNotice message={notice} />
    </div>
  );
}
