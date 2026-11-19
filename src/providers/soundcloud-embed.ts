import { FALLBACK_ARTWORK_SVG } from '../utils/format';
import {
  DEFAULT_CACHE_TTL_MS,
  MemoryCache,
  ProviderHttpError,
  fetchJsonWithRetry,
} from './cache';
import type { Artist, MusicProvider, Playlist, SearchResults, Track } from './types';

interface SoundCloudOEmbedResponse {
  version?: number;
  type?: string;
  provider_name?: string;
  title?: string;
  description?: string;
  thumbnail_url?: string;
  html?: string;
  author_name?: string;
  author_url?: string;
}

export interface SoundCloudExample {
  label: string;
  url: string;
}

export const SOUNDCLOUD_EXAMPLES: readonly SoundCloudExample[] = [
  {
    label: 'Forss — Flickermood',
    url: 'https://soundcloud.com/forss/flickermood',
  },
] as const;

const SOUNDCLOUD_HOSTS = new Set([
  'soundcloud.com',
  'www.soundcloud.com',
  'm.soundcloud.com',
  'on.soundcloud.com',
]);

const scCache = new MemoryCache(DEFAULT_CACHE_TTL_MS);

function addSchemeIfMissing(input: string): string {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(?:www\.|m\.|on\.)?soundcloud\.com\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function isSoundCloudUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(addSchemeIfMissing(trimmed));
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      SOUNDCLOUD_HOSTS.has(parsed.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

export function normalizeSoundCloudTrackUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed || !isSoundCloudUrl(trimmed)) {
    throw new Error(
      'Введіть коректне посилання на публічний трек SoundCloud (наприклад, https://soundcloud.com/forss/flickermood).',
    );
  }

  const parsed = new URL(addSchemeIfMissing(trimmed));
  const hostname = parsed.hostname.toLowerCase();

  if (hostname === 'on.soundcloud.com') {
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length === 0) {
      throw new Error('Вставте повне коротке посилання on.soundcloud.com на конкретний трек.');
    }
    return `https://on.soundcloud.com/${parts.join('/')}`;
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    throw new Error('Вставте посилання саме на конкретний трек, а не на профіль артиста.');
  }

  if (segments.includes('sets')) {
    throw new Error(
      'Вставте посилання на окремий публічний трек SoundCloud (плейлисти наразі не підтримуються у вбудованому режимі).',
    );
  }

  const clean = new URL(`https://soundcloud.com/${segments.join('/')}`);
  clean.hash = '';
  return clean.toString();
}

function extractIframeSrc(html: string): string | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const iframe = doc.querySelector('iframe');
    const src = iframe?.getAttribute('src');
    if (src) return src;
  } catch {
    // Використовуємо регулярний вираз як запасний варіант
  }

  const match = html.match(/src=["']([^"']+)["']/i);
  if (!match) return null;
  return match[1].replace(/&amp;/g, '&');
}

function configureEmbedSrc(rawSrc: string): string {
  const url = new URL(rawSrc);
  if (!url.href.startsWith('https://w.soundcloud.com/player/')) {
    throw new Error('Цей трек не підтримує вбудоване відтворення SoundCloud.');
  }

  url.searchParams.set('auto_play', 'false');
  url.searchParams.set('visual', 'false');
  url.searchParams.set('show_artwork', 'true');
  url.searchParams.set('show_comments', 'false');
  url.searchParams.set('show_reposts', 'false');
  url.searchParams.set('show_teaser', 'false');
  url.searchParams.set('buying', 'false');
  url.searchParams.set('sharing', 'false');
  url.searchParams.set('download', 'false');

  return url.toString();
}

function fnv1aHash(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildTrackId(embedSrc: string, normalizedUrl: string): string {
  try {
    const parsed = new URL(embedSrc);
    const innerUrl = parsed.searchParams.get('url');
    if (innerUrl) {
      const match = innerUrl.match(/\/tracks\/(\d+)/);
      if (match) return `sc-${match[1]}`;
    }
  } catch {
    // Ігноруємо помилку розбору
  }
  return `sc-${fnv1aHash(normalizedUrl)}`;
}

function cleanTrackTitle(rawTitle: string | undefined, authorName: string | undefined): string {
  const title = rawTitle?.trim() || 'Трек SoundCloud';
  if (!authorName?.trim()) return title;

  const suffix = ` by ${authorName.trim()}`;
  if (title.toLowerCase().endsWith(suffix.toLowerCase())) {
    const trimmed = title.slice(0, title.length - suffix.length).trim();
    if (trimmed) return trimmed;
  }
  return title;
}

export async function resolveSoundCloudUrl(
  rawUrl: string,
  signal?: AbortSignal,
): Promise<Track> {
  const normalizedUrl = normalizeSoundCloudTrackUrl(rawUrl);
  const cacheKey = `sc:oembed:${normalizedUrl.toLowerCase()}`;

  return scCache.getOrFetch(
    cacheKey,
    async () => {
      const endpoint = new URL('https://soundcloud.com/oembed');
      endpoint.searchParams.set('format', 'json');
      endpoint.searchParams.set('url', normalizedUrl);

      let data: SoundCloudOEmbedResponse;
      try {
        data = await fetchJsonWithRetry<SoundCloudOEmbedResponse>(endpoint.toString(), {
          timeoutMs: 10_000,
          retries: 1,
        });
      } catch (err) {
        if (err instanceof ProviderHttpError) {
          if (err.status === 403 || err.status === 401) {
            throw new Error(
              'Власник заборонив вбудовування цього треку або трек приватний. Доступні лише публічні треки з дозволеним embed.',
            );
          }
          if (err.status === 404) {
            throw new Error(
              'Трек за цим посиланням не знайдено на SoundCloud або він приватний.',
            );
          }
        }
        throw new Error(
          'Не вдалося отримати дані від SoundCloud oEmbed. Перевірте посилання та підключення до мережі.',
        );
      }

      if (!data.html) {
        throw new Error('Цей трек SoundCloud не можна вбудувати у сторонній плеєр.');
      }

      const rawSrc = extractIframeSrc(data.html);
      if (!rawSrc) {
        throw new Error('Не вдалося розпізнати вбудований плеєр у відповіді SoundCloud.');
      }

      const embedSrc = configureEmbedSrc(rawSrc);
      const id = buildTrackId(embedSrc, normalizedUrl);
      const artwork = data.thumbnail_url || FALLBACK_ARTWORK_SVG;

      const track: Track = {
        id,
        title: cleanTrackTitle(data.title, data.author_name),
        artist: data.author_name?.trim() || 'SoundCloud',
        artworkUrl: artwork,
        artworkThumbnailUrl: artwork,
        duration: 0,
        source: 'soundcloud',
        permalinkUrl: normalizedUrl,
        description: data.description,
        embedHtml: data.html,
        embedSrc,
      };

      scCache.set(`sc:track:${id}`, track);
      return track;
    },
    { signal },
  );
}

class SoundCloudEmbedProvider implements MusicProvider {
  readonly id = 'soundcloud' as const;
  readonly label = 'SoundCloud';

  clearCache(): void {
    scCache.clear();
  }

  async search(query: string, signal?: AbortSignal): Promise<SearchResults> {
    if (!isSoundCloudUrl(query)) {
      return { tracks: [], artists: [], playlists: [] };
    }
    const track = await resolveSoundCloudUrl(query, signal);
    return { tracks: [track], artists: [], playlists: [] };
  }

  async getTrending(_genre?: string, _signal?: AbortSignal): Promise<Track[]> {
    return [];
  }

  async getTrack(id: string, signal?: AbortSignal): Promise<Track | null> {
    const cached = scCache.get<Track>(`sc:track:${id}`);
    if (cached) return cached;
    if (isSoundCloudUrl(id)) {
      return resolveSoundCloudUrl(id, signal);
    }
    return null;
  }

  async getArtist(_id: string, _signal?: AbortSignal): Promise<Artist | null> {
    return null;
  }

  async getArtistTracks(_id: string, _signal?: AbortSignal): Promise<Track[]> {
    return [];
  }

  async getPlaylist(_id: string, _signal?: AbortSignal): Promise<Playlist | null> {
    return null;
  }

  async getStreamUrl(track: Track): Promise<string> {
    if (track.embedSrc) {
      return track.embedSrc;
    }
    const resolved = await resolveSoundCloudUrl(track.permalinkUrl);
    if (!resolved.embedSrc) {
      throw new Error('Не вдалося отримати посилання для вбудованого плеєра SoundCloud.');
    }
    return resolved.embedSrc;
  }
}

export const soundcloudProvider = new SoundCloudEmbedProvider();
