import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { MusicSource, Track } from '../providers/types';
import { FALLBACK_ARTWORK_SVG } from '../utils/format';

export interface UserPlaylist {
  id: string;
  title: string;
  description: string;
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
}

export interface LibraryExportData {
  version: 1;
  exportedAt: string;
  likedTracks: Track[];
  playlists: UserPlaylist[];
}

interface LibraryState {
  likedTracks: Track[];
  playlists: UserPlaylist[];
  playlistPickerTrack: Track | null;

  toggleLike: (track: Track) => boolean;
  createPlaylist: (title: string, description?: string) => UserPlaylist;
  renamePlaylist: (id: string, title: string, description?: string) => void;
  deletePlaylist: (id: string) => void;
  addTrackToPlaylist: (playlistId: string, track: Track) => boolean;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  openPlaylistPicker: (track: Track) => void;
  closePlaylistPicker: () => void;
  exportLibrary: () => LibraryExportData;
  importLibrary: (
    raw: unknown,
    mode?: 'merge' | 'replace',
  ) => { likedCount: number; playlistCount: number };
}

let playlistSeq = 0;

function makeLocalPlaylistId(): string {
  playlistSeq += 1;
  return `local-${Date.now().toString(36)}-${playlistSeq}`;
}

const ALLOWED_SOURCES = new Set<MusicSource>(['audius', 'soundcloud', 'spotify', 'jamendo']);

function normalizeImportedTrack(raw: unknown): Track | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id.trim()) return null;
  if (typeof obj.title !== 'string' || !obj.title.trim()) return null;

  const source: MusicSource =
    typeof obj.source === 'string' && ALLOWED_SOURCES.has(obj.source as MusicSource)
      ? (obj.source as MusicSource)
      : 'audius';

  return {
    id: obj.id,
    title: obj.title.trim(),
    artist: typeof obj.artist === 'string' && obj.artist.trim() ? obj.artist.trim() : 'Невідомий артист',
    artistId: typeof obj.artistId === 'string' ? obj.artistId : undefined,
    artistHandle: typeof obj.artistHandle === 'string' ? obj.artistHandle : undefined,
    artworkUrl:
      typeof obj.artworkUrl === 'string' && obj.artworkUrl
        ? obj.artworkUrl
        : FALLBACK_ARTWORK_SVG,
    artworkThumbnailUrl:
      typeof obj.artworkThumbnailUrl === 'string' ? obj.artworkThumbnailUrl : undefined,
    artworkMirrors: Array.isArray(obj.artworkMirrors)
      ? obj.artworkMirrors.filter((m): m is string => typeof m === 'string')
      : undefined,
    duration: typeof obj.duration === 'number' && Number.isFinite(obj.duration) ? obj.duration : 0,
    source,
    streamUrl: typeof obj.streamUrl === 'string' ? obj.streamUrl : undefined,
    permalinkUrl:
      typeof obj.permalinkUrl === 'string' && obj.permalinkUrl
        ? obj.permalinkUrl
        : 'https://audius.co',
    genre: typeof obj.genre === 'string' ? obj.genre : undefined,
    playCount: typeof obj.playCount === 'number' ? obj.playCount : undefined,
    favoriteCount: typeof obj.favoriteCount === 'number' ? obj.favoriteCount : undefined,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    embedHtml: typeof obj.embedHtml === 'string' ? obj.embedHtml : undefined,
    embedSrc: typeof obj.embedSrc === 'string' ? obj.embedSrc : undefined,
  };
}

function normalizeImportedPlaylist(raw: unknown): UserPlaylist | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.title !== 'string' || !obj.title.trim()) return null;
  if (!Array.isArray(obj.tracks)) return null;

  const tracks = obj.tracks
    .map(normalizeImportedTrack)
    .filter((t): t is Track => t !== null);

  const uniqueTracks: Track[] = [];
  const seen = new Set<string>();
  for (const t of tracks) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      uniqueTracks.push(t);
    }
  }

  const rawId = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : '';
  const id = rawId.startsWith('local-') ? rawId : makeLocalPlaylistId();
  const now = Date.now();

  return {
    id,
    title: obj.title.trim(),
    description: typeof obj.description === 'string' ? obj.description.trim() : '',
    tracks: uniqueTracks,
    createdAt: typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt) ? obj.createdAt : now,
    updatedAt: typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? obj.updatedAt : now,
  };
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      likedTracks: [],
      playlists: [],
      playlistPickerTrack: null,

      toggleLike: (track) => {
        const exists = get().likedTracks.some((t) => t.id === track.id);
        if (exists) {
          set((state) => ({
            likedTracks: state.likedTracks.filter((t) => t.id !== track.id),
          }));
          return false;
        }
        set((state) => ({
          likedTracks: [track, ...state.likedTracks],
        }));
        return true;
      },

      createPlaylist: (title, description = '') => {
        const now = Date.now();
        const playlist: UserPlaylist = {
          id: makeLocalPlaylistId(),
          title: title.trim() || 'Новий плейлист',
          description: description.trim(),
          tracks: [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          playlists: [playlist, ...state.playlists],
        }));
        return playlist;
      },

      renamePlaylist: (id, title, description) => {
        const cleanTitle = title.trim();
        if (!cleanTitle) return;

        set((state) => ({
          playlists: state.playlists.map((pl) =>
            pl.id === id
              ? {
                  ...pl,
                  title: cleanTitle,
                  description: description !== undefined ? description.trim() : pl.description,
                  updatedAt: Date.now(),
                }
              : pl,
          ),
        }));
      },

      deletePlaylist: (id) => {
        set((state) => ({
          playlists: state.playlists.filter((pl) => pl.id !== id),
        }));
      },

      addTrackToPlaylist: (playlistId, track) => {
        const target = get().playlists.find((pl) => pl.id === playlistId);
        if (!target) return false;
        if (target.tracks.some((t) => t.id === track.id)) {
          return false;
        }
        set((state) => ({
          playlists: state.playlists.map((pl) =>
            pl.id === playlistId
              ? {
                  ...pl,
                  tracks: [...pl.tracks, track],
                  updatedAt: Date.now(),
                }
              : pl,
          ),
        }));
        return true;
      },

      removeTrackFromPlaylist: (playlistId, trackId) => {
        set((state) => ({
          playlists: state.playlists.map((pl) =>
            pl.id === playlistId
              ? {
                  ...pl,
                  tracks: pl.tracks.filter((t) => t.id !== trackId),
                  updatedAt: Date.now(),
                }
              : pl,
          ),
        }));
      },

      openPlaylistPicker: (track) => {
        set({ playlistPickerTrack: track });
      },

      closePlaylistPicker: () => {
        set({ playlistPickerTrack: null });
      },

      exportLibrary: () => {
        const { likedTracks, playlists } = get();
        return {
          version: 1,
          exportedAt: new Date().toISOString(),
          likedTracks,
          playlists,
        };
      },

      importLibrary: (raw, mode = 'merge') => {
        if (!raw || typeof raw !== 'object') {
          throw new Error('Невірний формат JSON: очікується об’єкт бібліотеки.');
        }

        const obj = raw as Record<string, unknown>;
        const hasLiked = Array.isArray(obj.likedTracks);
        const hasPlaylists = Array.isArray(obj.playlists);

        if (!hasLiked && !hasPlaylists) {
          throw new Error(
            'Невірний формат файлу: відсутні масиви «likedTracks» або «playlists».',
          );
        }

        const importedLikes: Track[] = [];
        const seenLikes = new Set<string>();
        if (hasLiked) {
          for (const item of obj.likedTracks as unknown[]) {
            const track = normalizeImportedTrack(item);
            if (track && !seenLikes.has(track.id)) {
              seenLikes.add(track.id);
              importedLikes.push(track);
            }
          }
        }

        const importedPlaylists: UserPlaylist[] = [];
        if (hasPlaylists) {
          for (const item of obj.playlists as unknown[]) {
            const pl = normalizeImportedPlaylist(item);
            if (pl) {
              importedPlaylists.push(pl);
            }
          }
        }

        if (mode === 'replace') {
          set({
            likedTracks: importedLikes,
            playlists: importedPlaylists,
          });
          return {
            likedCount: importedLikes.length,
            playlistCount: importedPlaylists.length,
          };
        }

        const current = get();
        const mergedLikes = [...current.likedTracks];
        const existingLikeIds = new Set(mergedLikes.map((t) => t.id));
        for (const track of importedLikes) {
          if (!existingLikeIds.has(track.id)) {
            existingLikeIds.add(track.id);
            mergedLikes.push(track);
          }
        }

        const mergedPlaylists = [...current.playlists];
        for (const incoming of importedPlaylists) {
          const existingIdx = mergedPlaylists.findIndex((p) => p.id === incoming.id);
          if (existingIdx >= 0) {
            const existing = mergedPlaylists[existingIdx];
            const trackIds = new Set(existing.tracks.map((t) => t.id));
            const nextTracks = [...existing.tracks];
            for (const track of incoming.tracks) {
              if (!trackIds.has(track.id)) {
                trackIds.add(track.id);
                nextTracks.push(track);
              }
            }
            mergedPlaylists[existingIdx] = {
              ...existing,
              tracks: nextTracks,
              updatedAt: Date.now(),
            };
          } else {
            mergedPlaylists.push(incoming);
          }
        }

        set({
          likedTracks: mergedLikes,
          playlists: mergedPlaylists,
        });

        return {
          likedCount: importedLikes.length,
          playlistCount: importedPlaylists.length,
        };
      },
    }),
    {
      name: 'wave-library',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        likedTracks: state.likedTracks,
        playlists: state.playlists,
      }),
    },
  ),
);
