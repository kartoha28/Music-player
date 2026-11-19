import { MotionConfig } from 'framer-motion';
import { Suspense, lazy, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AmbientBackground } from './components/AmbientBackground';
import { Player } from './components/Player';
import { PlaylistPickerModal } from './components/PlaylistPickerModal';
import { Sidebar } from './components/Sidebar';
import { PageSkeleton } from './components/Skeleton';
import { SoundCloudModal } from './components/SoundCloudModal';
import { applySettingsToDom, useSettingsStore } from './store/settingsStore';

const HomePage = lazy(() => import('./pages/Home'));
const SearchPage = lazy(() => import('./pages/Search'));
const ArtistPage = lazy(() => import('./pages/Artist'));
const PlaylistPage = lazy(() => import('./pages/Playlist'));
const LibraryPage = lazy(() => import('./pages/Library'));
const SettingsPage = lazy(() => import('./pages/Settings'));

export default function App() {
  const theme = useSettingsStore((s) => s.theme);
  const glassIntensity = useSettingsStore((s) => s.glassIntensity);
  const refractionEnabled = useSettingsStore((s) => s.refractionEnabled);

  useEffect(() => {
    applySettingsToDom({ theme, glassIntensity, refractionEnabled });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = () => {
      if (useSettingsStore.getState().theme === 'system') {
        applySettingsToDom(useSettingsStore.getState());
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, glassIntensity, refractionEnabled]);

  return (
    <MotionConfig reducedMotion="user">
      <HashRouter>
        <a href="#main-content" className="skip-link">
          Перейти до основного вмісту
        </a>

        <AmbientBackground />

        <div className="relative min-h-screen">
          <Sidebar />

          <main
            id="main-content"
            tabIndex={-1}
            className="min-h-screen px-4 pt-5 pb-[calc(var(--mobile-nav-height)+var(--player-bar-height)+2rem)] sm:px-6 lg:pl-[calc(var(--sidebar-width)+2.5rem)] lg:pr-8 lg:pt-8 lg:pb-[calc(var(--player-bar-height)+2.5rem)]"
          >
            <div className="mx-auto max-w-6xl">
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/artist/:id" element={<ArtistPage />} />
                  <Route path="/playlist/:id" element={<PlaylistPage />} />
                  <Route path="/library" element={<LibraryPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </div>
          </main>

          <Player />
          <PlaylistPickerModal />
          <SoundCloudModal />
        </div>
      </HashRouter>
    </MotionConfig>
  );
}
