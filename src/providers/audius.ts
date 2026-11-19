import { FALLBACK_ARTWORK_SVG } from '../utils/format';
import {
  DEFAULT_CACHE_TTL_MS,
  MemoryCache,
  ProviderHttpError,
  fetchJsonWithRetry,
} from './cache';
import type { Artist, MusicProvider, Playlist, SearchResults, Track } from './types';

const APP_NAME = 'HvyliaMusicPlayer';
const DISCOVERY_BOOTSTRAP = 'https://api.audius.co';
const FALLBACK_HOST = 'https://api.audius.co';
const HOST_TTL_MS = 15 * 60 * 1000;

export interface GenreOption {
  value: string;
  label: string;
}

export const AUDIUS_GENRES: readonly GenreOption[] = [
  { value: '', label: 'Усі' },
  { value: 'Electronic', label: 'Електроніка' },
  { value: 'Hip-Hop/Rap', label: 'Хіп-хоп і реп' },
  { value: 'Pop', label: 'Поп' },
  { value: 'House', label: 'Хаус' },
  { value: 'Drum & Bass', label: 'Драм-н-бейс' },
  { value: 'R&B/Soul', label: 'R&B / Соул' },
  { value: 'Ambient', label: 'Ембієнт' },
  { value: 'Techno', label: 'Техно' },
  { value: 'Alternative', label: 'Інді' },
  { value: 'Rock', label: 'Рок' },
  { value: 'Jazz', label: 'Джаз' },
] as const;

interface AudiusArtwork {
  '150x150'?: string;
  '480x480'?: string;
  '1000x1000'?: string;
  mirrors?: string[];
}

interface AudiusCoverPhoto {
  '640x'?: string;
  '2000x'?: string;
  mirrors?: string[];
}

interface AudiusUser {
  id: string;
  name: string;
  handle: string;
  bio?: string | null;
  profile_picture?: AudiusArtwork | null;
  cover_photo?: AudiusCoverPhoto | null;
  follower_count?: number;
  track_count?: number;
  is_verified?: boolean;
  is_deactivated?: boolean;
}

interface AudiusTrack {
  id: string;
  title: string;
  duration?: number;
  genre?: string | null;
  description?: string | null;
  artwork?: AudiusArtwork | null;
  user?: AudiusUser | null;
  permalink?: string | null;
  play_count?: number;
  favorite_count?: number;
  is_stream_gated?: boolean;
}

interface AudiusPlaylist {
  id: string;
  playlist_name: string;
  description?: string | null;
  artwork?: AudiusArtwork | null;
  user?: AudiusUser | null;
  track_count?: number;
  total_play_count?: number;
  is_album?: boolean;
  permalink?: string | null;
  playlist_contents?: unknown[];
  tracks?: AudiusTrack[];
}

interface AudiusResponse<T> {
  data: T;
}

function pickArtwork(
  artwork: AudiusArtwork | null | undefined,
  preferred: '480x480' | '150x150' | '1000x1000' = '480x480',
): string {
  if (!artwork) return FALLBACK_ARTWORK_SVG;
  return (
    artwork[preferred] ||
    artwork['480x480'] ||
    artwork['1000x1000'] ||
    artwork['150x150'] ||
    FALLBACK_ARTWORK_SVG
  );
}

function toFullPermalink(permalink: string | null | undefined, fallbackPath = ''): string {
  if (!permalink) {
    return fallbackPath ? `https://audius.co${fallbackPath}` : 'https://audius.co';
  }
  if (permalink.startsWith('http://') || permalink.startsWith('https://')) {
    return permalink;
  }
  const normalized = permalink.startsWith('/') ? permalink : `/${permalink}`;
  return `https://audius.co${normalized}`;
}

function buildStreamUrl(host: string, trackId: string): string {
  const url = new URL(`/v1/tracks/${encodeURIComponent(trackId)}/stream`, host);
  url.searchParams.set('app_name', APP_NAME);
  return url.toString();
}

function mapArtist(raw: AudiusUser): Artist {
  const handle = raw.handle || raw.id;
  return {
    id: raw.id,
    name: raw.name || handle || 'Невідомий артист',
    handle,
    avatarUrl: pickArtwork(raw.profile_picture, '480x480'),
    avatarMirrors: raw.profile_picture?.mirrors,
    coverUrl: raw.cover_photo?.['2000x'] || raw.cover_photo?.['640x'],
    bio: raw.bio ?? undefined,
    followerCount: raw.follower_count,
    trackCount: raw.track_count,
    isVerified: Boolean(raw.is_verified),
    source: 'audius',
    permalinkUrl: `https://audius.co/${encodeURIComponent(handle)}`,
  };
}

function isPlayableAudiusTrack(raw: AudiusTrack | null | undefined): raw is AudiusTrack {
  return Boolean(raw && raw.id && raw.title && !raw.is_stream_gated);
}

function mapTrack(raw: AudiusTrack, host: string): Track {
  const handle = raw.user?.handle;
  return {
    id: raw.id,
    title: raw.title,
    artist: raw.user?.name || 'Невідомий артист',
    artistId: raw.user?.id,
    artistHandle: handle,
    artworkUrl: pickArtwork(raw.artwork, '480x480'),
    artworkThumbnailUrl: pickArtwork(raw.artwork, '150x150'),
    artworkMirrors: raw.artwork?.mirrors,
    duration: Number(raw.duration) || 0,
    source: 'audius',
    streamUrl: buildStreamUrl(host, raw.id),
    permalinkUrl: toFullPermalink(raw.permalink, handle ? `/${handle}` : ''),
    genre: raw.genre ?? undefined,
    playCount: raw.play_count,
    favoriteCount: raw.favorite_count,
    description: raw.description ?? undefined,
  };
}

function mapPlaylist(raw: AudiusPlaylist, host: string, tracks?: Track[]): Playlist {
  const embeddedTracks =
    tracks ??
    (Array.isArray(raw.tracks) && raw.tracks.length > 0
      ? raw.tracks.filter(isPlayableAudiusTrack).map((item) => mapTrack(item, host))
      : undefined);

  return {
    id: raw.id,
    title: raw.playlist_name || 'Плейлист без назви',
    description: raw.description ?? undefined,
    artworkUrl: pickArtwork(raw.artwork, '480x480'),
    artworkMirrors: raw.artwork?.mirrors,
    ownerName: raw.user?.name || 'Користувач Audius',
    ownerId: raw.user?.id,
    trackCount:
      tracks !== undefined
        ? tracks.length
        : embeddedTracks?.length ?? raw.track_count ?? raw.playlist_contents?.length ?? 0,
    totalPlayCount: raw.total_play_count,
    isAlbum: Boolean(raw.is_album),
    tracks: embeddedTracks,
    source: 'audius',
    permalinkUrl: toFullPermalink(raw.permalink),
  };
}

class AudiusProvider implements MusicProvider {
  readonly id = 'audius' as const;
  readonly label = 'Audius';

  private readonly cache = new MemoryCache(DEFAULT_CACHE_TTL_MS);
  private cachedHosts: string[] = [];
  private hostsFetchedAt = 0;
  private inflightHosts: Promise<string[]> | null = null;

  clearCache(): void {
    this.cache.clear();
  }

  private async getDiscoveryHosts(): Promise<string[]> {
    const now = Date.now();
    if (this.cachedHosts.length > 0 && now - this.hostsFetchedAt < HOST_TTL_MS) {
      return this.cachedHosts;
    }

    if (this.inflightHosts) {
      return this.inflightHosts;
    }

    this.inflightHosts = (async () => {
      try {
        const res = await fetchJsonWithRetry<AudiusResponse<string[]>>(DISCOVERY_BOOTSTRAP, {
          timeoutMs: 6_000,
          retries: 1,
        });

        const valid = Array.isArray(res.data)
          ? res.data
              .filter((item): item is string => typeof item === 'string' && item.startsWith('https://'))
              .map((item) => item.replace(/\/+$/, ''))
          : [];

        const hosts =
          valid.length > 0 ? Array.from(new Set([...valid, FALLBACK_HOST])) : [FALLBACK_HOST];
        this.cachedHosts = hosts;
        this.hostsFetchedAt = Date.now();
        return hosts;
      } catch {
        this.cachedHosts = [FALLBACK_HOST];
        this.hostsFetchedAt = Date.now();
        return this.cachedHosts;
      } finally {
        this.inflightHosts = null;
      }
    })();

    return this.inflightHosts;
  }

  async resolveDiscoveryHost(): Promise<string> {
    const hosts = await this.getDiscoveryHosts();
    return hosts[0] ?? FALLBACK_HOST;
  }

  private async request<T>(
    path: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<{ data: T; host: string }> {
    const hosts = await this.getDiscoveryHosts();
    const orderedHosts = hosts.length > 0 ? hosts : [FALLBACK_HOST];
    let lastError: unknown;

    for (let i = 0; i < Math.min(orderedHosts.length, 3); i++) {
      const host = orderedHosts[i];
      const url = new URL(path, host);
      url.searchParams.set('app_name', APP_NAME);

      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }

      try {
        const res = await fetchJsonWithRetry<AudiusResponse<T>>(url.toString(), {
          timeoutMs: 10_000,
          retries: 2,
        });
        return { data: res.data, host };
      } catch (error) {
        if (error instanceof ProviderHttpError && error.status === 404) {
          throw error;
        }
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Не вдалося отримати дані від Audius API');
  }

  async getTrending(genre?: string, signal?: AbortSignal): Promise<Track[]> {
    const normalizedGenre = genre?.trim() || '';
    const cacheKey = `trending:${normalizedGenre || 'all'}`;

    return this.cache.getOrFetch(
      cacheKey,
      async () => {
        const { data, host } = await this.request<AudiusTrack[]>('/v1/tracks/trending', {
          limit: 24,
          genre: normalizedGenre || undefined,
        });

        if (!Array.isArray(data)) return [];
        return data.filter(isPlayableAudiusTrack).map((item) => mapTrack(item, host));
      },
      { signal },
    );
  }

  async search(query: string, signal?: AbortSignal): Promise<SearchResults> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { tracks: [], artists: [], playlists: [] };
    }

    const cacheKey = `search:${trimmed.toLowerCase()}`;
    return this.cache.getOrFetch(
      cacheKey,
      async () => {
        const [tracksRes, artistsRes, playlistsRes] = await Promise.allSettled([
          this.request<AudiusTrack[]>('/v1/tracks/search', { query: trimmed, limit: 30 }),
          this.request<AudiusUser[]>('/v1/users/search', { query: trimmed, limit: 16 }),
          this.request<AudiusPlaylist[]>('/v1/playlists/search', { query: trimmed, limit: 16 }),
        ]);

        if (
          tracksRes.status === 'rejected' &&
          artistsRes.status === 'rejected' &&
          playlistsRes.status === 'rejected'
        ) {
          throw tracksRes.reason instanceof Error
            ? tracksRes.reason
            : new Error('Не вдалося виконати пошук на Audius');
        }

        const tracks =
          tracksRes.status === 'fulfilled' && Array.isArray(tracksRes.value.data)
            ? tracksRes.value.data
                .filter(isPlayableAudiusTrack)
                .map((item) => mapTrack(item, tracksRes.value.host))
            : [];

        const artists =
          artistsRes.status === 'fulfilled' && Array.isArray(artistsRes.value.data)
            ? artistsRes.value.data
                .filter((user) => Boolean(user && user.id && !user.is_deactivated))
                .map(mapArtist)
            : [];

        const playlists =
          playlistsRes.status === 'fulfilled' && Array.isArray(playlistsRes.value.data)
            ? playlistsRes.value.data
                .filter((pl) => Boolean(pl && pl.id))
                .map((pl) => mapPlaylist(pl, playlistsRes.value.host))
            : [];

        return { tracks, artists, playlists };
      },
      { signal },
    );
  }

  async getTrack(id: string, signal?: AbortSignal): Promise<Track | null> {
    const cleanId = id.trim();
    if (!cleanId) return null;

    return this.cache.getOrFetch(
      `track:${cleanId}`,
      async () => {
        try {
          const { data, host } = await this.request<AudiusTrack | AudiusTrack[]>(
            `/v1/tracks/${encodeURIComponent(cleanId)}`,
          );
          const item = Array.isArray(data) ? data[0] : data;
          if (!isPlayableAudiusTrack(item)) return null;
          return mapTrack(item, host);
        } catch (error) {
          if (error instanceof ProviderHttpError && error.status === 404) {
            return null;
          }
          throw error;
        }
      },
      { signal },
    );
  }

  async getArtist(id: string, signal?: AbortSignal): Promise<Artist | null> {
    const cleanId = id.trim();
    if (!cleanId) return null;

    return this.cache.getOrFetch(
      `artist:${cleanId}`,
      async () => {
        try {
          const { data } = await this.request<AudiusUser | AudiusUser[]>(
            `/v1/users/${encodeURIComponent(cleanId)}`,
          );
          const user = Array.isArray(data) ? data[0] : data;
          return user && user.id ? mapArtist(user) : null;
        } catch (error) {
          if (error instanceof ProviderHttpError && error.status === 404) {
            return null;
          }
          throw error;
        }
      },
      { signal },
    );
  }

  async getArtistTracks(id: string, signal?: AbortSignal): Promise<Track[]> {
    const cleanId = id.trim();
    if (!cleanId) return [];

    return this.cache.getOrFetch(
      `artistTracks:${cleanId}`,
      async () => {
        const { data, host } = await this.request<AudiusTrack[]>(
          `/v1/users/${encodeURIComponent(cleanId)}/tracks`,
          { limit: 50 },
        );
        if (!Array.isArray(data)) return [];
        return data.filter(isPlayableAudiusTrack).map((item) => mapTrack(item, host));
      },
      { signal },
    );
  }

  async getPlaylist(id: string, signal?: AbortSignal): Promise<Playlist | null> {
    const cleanId = id.trim();
    if (!cleanId) return null;

    return this.cache.getOrFetch(
      `playlist:${cleanId}`,
      async () => {
        try {
          const [metaRes, tracksRes] = await Promise.all([
            this.request<AudiusPlaylist | AudiusPlaylist[]>(
              `/v1/playlists/${encodeURIComponent(cleanId)}`,
            ),
            this.request<AudiusTrack[]>(
              `/v1/playlists/${encodeURIComponent(cleanId)}/tracks`,
            ).catch(() => null),
          ]);

          const rawPlaylist = Array.isArray(metaRes.data) ? metaRes.data[0] : metaRes.data;
          if (!rawPlaylist || !rawPlaylist.id) return null;

          const mappedTracks =
            tracksRes && Array.isArray(tracksRes.data)
              ? tracksRes.data
                  .filter(isPlayableAudiusTrack)
                  .map((item) => mapTrack(item, tracksRes.host))
              : undefined;

          return mapPlaylist(rawPlaylist, metaRes.host, mappedTracks);
        } catch (error) {
          if (error instanceof ProviderHttpError && error.status === 404) {
            return null;
          }
          throw error;
        }
      },
      { signal },
    );
  }

  async getStreamUrl(track: Track): Promise<string> {
    const host = await this.resolveDiscoveryHost();
    return buildStreamUrl(host, track.id);
  }
}

export const audiusProvider = new AudiusProvider();
