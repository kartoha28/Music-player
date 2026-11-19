export type BuiltInSource = 'audius' | 'soundcloud';
export type MusicSource = BuiltInSource | 'spotify' | 'jamendo';

export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  artistHandle?: string;
  artworkUrl: string;
  artworkThumbnailUrl?: string;
  artworkMirrors?: string[];
  duration: number;
  source: MusicSource;
  streamUrl?: string;
  permalinkUrl: string;
  genre?: string;
  playCount?: number;
  favoriteCount?: number;
  description?: string;
  embedHtml?: string;
  embedSrc?: string;
}

export interface Artist {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
  avatarMirrors?: string[];
  coverUrl?: string;
  bio?: string;
  followerCount?: number;
  trackCount?: number;
  isVerified?: boolean;
  source: MusicSource;
  permalinkUrl: string;
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  artworkUrl: string;
  artworkMirrors?: string[];
  ownerName: string;
  ownerId?: string;
  trackCount: number;
  totalPlayCount?: number;
  isAlbum?: boolean;
  tracks?: Track[];
  source: MusicSource;
  permalinkUrl?: string;
  isLocal?: boolean;
}

export interface SearchResults {
  tracks: Track[];
  artists: Artist[];
  playlists: Playlist[];
}

export interface MusicProvider {
  readonly id: MusicSource;
  readonly label: string;
  search(query: string, signal?: AbortSignal): Promise<SearchResults>;
  getTrending(genre?: string, signal?: AbortSignal): Promise<Track[]>;
  getTrack(id: string, signal?: AbortSignal): Promise<Track | null>;
  getArtist(id: string, signal?: AbortSignal): Promise<Artist | null>;
  getArtistTracks(id: string, signal?: AbortSignal): Promise<Track[]>;
  getPlaylist(id: string, signal?: AbortSignal): Promise<Playlist | null>;
  getStreamUrl(track: Track): Promise<string>;
  clearCache?(): void;
}
