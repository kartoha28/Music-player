import { AUDIUS_GENRES, audiusProvider } from './audius';
import {
  SOUNDCLOUD_EXAMPLES,
  isSoundCloudUrl,
  resolveSoundCloudUrl,
  soundcloudProvider,
} from './soundcloud-embed';
import type { MusicProvider, MusicSource } from './types';

/**
 * Реєстр провайдерів музики.
 * Нові джерела (наприклад, Spotify PKCE або Jamendo) реєструються через `registerProvider(...)`
 * з реалізацією єдиного інтерфейсу `MusicProvider` без зміни UI-компонентів.
 */
const providers = new Map<MusicSource, MusicProvider>([
  ['audius', audiusProvider],
  ['soundcloud', soundcloudProvider],
]);

export function registerProvider(provider: MusicProvider): void {
  providers.set(provider.id, provider);
}

export function getProvider(source: MusicSource): MusicProvider | undefined {
  return providers.get(source);
}

export function getDefaultProvider(): MusicProvider {
  return audiusProvider;
}

export function getRegisteredProviders(): MusicProvider[] {
  return Array.from(providers.values());
}

export {
  AUDIUS_GENRES,
  SOUNDCLOUD_EXAMPLES,
  audiusProvider,
  isSoundCloudUrl,
  resolveSoundCloudUrl,
  soundcloudProvider,
};
export type { GenreOption } from './audius';
export type { SoundCloudExample } from './soundcloud-embed';
export type {
  Artist,
  BuiltInSource,
  MusicProvider,
  MusicSource,
  Playlist,
  SearchResults,
  Track,
} from './types';
