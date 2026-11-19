import { MotionConfig } from 'framer-motion';
import { Suspense, lazy, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AmbientBackground } from './components/AmbientBackground';
import { Sidebar } from './components/Sidebar';
import { PageSkeleton } from './components/Skeleton';

const HomePage = lazy(() => import('./pages/Home'));
const SearchPage = lazy(() => import('./pages/Search'));
const ArtistPage = lazy(() => import('./pages/Artist'));
const PlaylistPage = lazy(() => import('./pages/Playlist'));
const LibraryPage = lazy(() => import('./pages/Library'));
const SettingsPage = lazy(() => import('./pages/Settings'));

export default function App() {
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = () => {
      try {
        const raw = localStorage.getItem('wave-settings');
        if (!raw) return;
        const parsed = JSON.parse(raw) as {
          theme?: 'dark' | 'light' | 'system';
          glassIntensity?: 'low' | 'medium' | 'high';
          state?: {
            theme?: 'dark' | 'light' | 'system';
            glassIntensity?: 'low' | 'medium' | 'high';
          };
        };
        const src = parsed.state ?? parsed;
        if (src.theme === 'system') {
          const resolved = mediaQuery.matches ? 'light' : 'dark';
          document.documentElement.dataset.theme = resolved;
          document.documentElement.dataset.glass = src.glassIntensity ?? 'medium';
          const meta = document.querySelector('meta[name="theme-color"]');
          if (meta) {
            meta.setAttribute('content', resolved === 'light' ? '#e9eff8' : '#070a12');
          }
        }
      } catch {
        // Ігноруємо помилку читання localStorage
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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
            className="min-h-screen px-4 pt-5 pb-[calc(var(--mobile-nav-height)+2rem)] sm:px-6 lg:pl-[calc(var(--sidebar-width)+2.5rem)] lg:pr-8 lg:py-8"
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
        </div>
      </HashRouter>
    </MotionConfig>
  );
}
