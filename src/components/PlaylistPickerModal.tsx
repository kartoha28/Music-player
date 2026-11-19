import { AnimatePresence, motion } from 'framer-motion';
import { Check, FolderPlus, ListMusic, Plus, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useLibraryStore } from '../store/libraryStore';
import { formatCountWithUnit, handleArtworkError } from '../utils/format';
import { GlassButton } from './GlassButton';

export function PlaylistPickerModal() {
  const track = useLibraryStore((s) => s.playlistPickerTrack);
  const playlists = useLibraryStore((s) => s.playlists);
  const closePicker = useLibraryStore((s) => s.closePlaylistPicker);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const addTrackToPlaylist = useLibraryStore((s) => s.addTrackToPlaylist);
  const removeTrackFromPlaylist = useLibraryStore((s) => s.removeTrackFromPlaylist);

  const [newTitle, setNewTitle] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!track) {
      setNewTitle('');
      setFeedback(null);
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePicker();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [track, closePicker]);

  const handleCreateAndAdd = (event: FormEvent) => {
    event.preventDefault();
    if (!track) return;
    const clean = newTitle.trim();
    if (!clean) return;

    const created = createPlaylist(clean);
    addTrackToPlaylist(created.id, track);
    setNewTitle('');
    setFeedback(`Створено плейлист «${created.title}» і додано трек.`);
  };

  const handleToggleInPlaylist = (playlistId: string, playlistTitle: string, exists: boolean) => {
    if (!track) return;
    if (exists) {
      removeTrackFromPlaylist(playlistId, track.id);
      setFeedback(`Видалено з плейлиста «${playlistTitle}».`);
    } else {
      addTrackToPlaylist(playlistId, track);
      setFeedback(`Додано до плейлиста «${playlistTitle}».`);
    }
  };

  return (
    <AnimatePresence>
      {track && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={closePicker}
            aria-hidden="true"
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs"
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="playlist-picker-title"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="pointer-events-auto w-full max-w-md glass-panel-strong overflow-hidden flex flex-col max-h-[85vh]"
            >
              <header className="flex items-center justify-between gap-3 border-b border-[var(--glass-border-subtle)] px-5 py-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <FolderPlus className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h2
                    id="playlist-picker-title"
                    className="m-0 text-base font-semibold text-[var(--text-primary)] truncate"
                  >
                    Додати до плейлиста
                  </h2>
                </div>

                <GlassButton
                  variant="glass"
                  size="icon"
                  className="h-8 w-8"
                  onClick={closePicker}
                  aria-label="Закрити вікно вибору плейлиста"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </GlassButton>
              </header>

              <div className="px-5 py-3 border-b border-[var(--glass-border-subtle)] flex items-center gap-3 bg-[var(--glass-bg)]">
                <img
                  src={track.artworkThumbnailUrl || track.artworkUrl}
                  alt=""
                  width={42}
                  height={42}
                  onError={(event) => handleArtworkError(event, track.artworkMirrors)}
                  className="h-10 w-10 shrink-0 rounded-xl object-cover bg-[var(--bg-elevated)]"
                />
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-semibold text-[var(--text-primary)]">
                    {track.title}
                  </p>
                  <p className="m-0 truncate text-xs text-[var(--text-secondary)]">
                    {track.artist}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {playlists.length === 0 ? (
                  <div className="py-6 text-center space-y-2">
                    <ListMusic className="h-8 w-8 mx-auto text-[var(--text-muted)]" aria-hidden="true" />
                    <p className="m-0 text-sm text-[var(--text-secondary)]">
                      У вас ще немає власних плейлистів. Створіть перший нижче.
                    </p>
                  </div>
                ) : (
                  playlists.map((pl) => {
                    const exists = pl.tracks.some((t) => t.id === track.id);
                    return (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => handleToggleInPlaylist(pl.id, pl.title, exists)}
                        className={[
                          'w-full flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-colors cursor-pointer',
                          exists
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                            : 'border-[var(--glass-border-subtle)] bg-[var(--glass-bg)] hover:bg-[var(--glass-bg-hover)]',
                        ].join(' ')}
                      >
                        <div className="min-w-0">
                          <p className="m-0 truncate text-sm font-semibold text-[var(--text-primary)]">
                            {pl.title}
                          </p>
                          <p className="m-0 text-xs text-[var(--text-muted)]">
                            {formatCountWithUnit(pl.tracks.length, 'трек', 'треки', 'треків')}
                          </p>
                        </div>

                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                            exists
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]'
                              : 'border-[var(--glass-border)] text-[var(--text-muted)]'
                          }`}
                        >
                          {exists ? (
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {feedback && (
                <div
                  role="status"
                  className="mx-4 mb-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]"
                >
                  {feedback}
                </div>
              )}

              <form
                onSubmit={handleCreateAndAdd}
                className="border-t border-[var(--glass-border-subtle)] p-4 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="Назва нового плейлиста..."
                  aria-label="Назва нового плейлиста"
                  maxLength={80}
                  className="flex-1 min-w-0 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
                <GlassButton
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={!newTitle.trim()}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Створити</span>
                </GlassButton>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
