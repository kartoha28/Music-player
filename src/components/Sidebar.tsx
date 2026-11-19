import { AudioLines, Home, Library, Link2, Search, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { usePlayerStore } from '../store/playerStore';
import { GlassButton } from './GlassButton';

const NAV_ITEMS = [
  { to: '/', label: 'Головна', icon: Home, end: true },
  { to: '/search', label: 'Пошук', icon: Search, end: false },
  { to: '/library', label: 'Бібліотека', icon: Library, end: false },
  { to: '/settings', label: 'Налаштування', icon: Settings, end: false },
] as const;

export function Sidebar() {
  const openSoundCloudModal = usePlayerStore((s) => s.openSoundCloudModal);

  return (
    <>
      {/* Бокова скляна навігація для десктопу */}
      <aside
        aria-label="Бічна навігація"
        className="hidden lg:flex fixed top-4 left-4 bottom-4 z-30 w-[var(--sidebar-width)] flex-col gap-6 p-5 glass-panel"
      >
        <NavLink
          to="/"
          className="flex items-center gap-3 px-2 py-1 rounded-2xl text-[var(--text-primary)] no-underline"
        >
          <span
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_10px_24px_var(--accent-soft)]"
            style={{
              background:
                'linear-gradient(135deg var(--in-oklab), var(--ambient-1), var(--ambient-2))',
            }}
          >
            <AudioLines className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-bold tracking-tight">Хвиля</span>
            <span className="text-xs text-[var(--text-muted)]">Liquid Glass Audio</span>
          </span>
        </NavLink>

        <nav aria-label="Основна навігація" className="flex flex-col gap-1.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 no-underline',
                  isActive
                    ? 'bg-[var(--glass-bg-active)] text-[var(--text-primary)] border border-[var(--glass-border)] shadow-[inset_0_1px_0_var(--glass-highlight)]'
                    : 'text-[var(--text-secondary)] border border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-5 w-5 shrink-0 ${
                      isActive ? 'text-[var(--accent)]' : ''
                    }`}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <GlassButton
            variant="glass"
            size="md"
            className="w-full justify-start"
            onClick={() => openSoundCloudModal()}
          >
            <Link2 className="h-4 w-4 text-[var(--accent)] shrink-0" aria-hidden="true" />
            <span>Додати SoundCloud</span>
          </GlassButton>

          <div className="rounded-2xl border border-[var(--glass-border-subtle)] bg-[var(--glass-bg)] p-3.5 text-xs text-[var(--text-secondary)]">
            <p className="m-0 font-semibold text-[var(--text-primary)]">Лише легальні джерела</p>
            <p className="mt-1 mb-0 leading-relaxed text-[var(--text-muted)]">
              Audius Open API та офіційний вбудований плеєр SoundCloud.
            </p>
          </div>
        </div>
      </aside>

      {/* Нижня навігація для мобільних екранів */}
      <nav
        aria-label="Основна навігація"
        className="lg:hidden fixed bottom-3 left-3 right-3 z-30 h-[var(--mobile-nav-height)] px-2 glass-panel flex items-center justify-around"
      >
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-1.5 text-[11px] font-medium transition-colors no-underline min-w-[64px]',
                isActive
                  ? 'text-[var(--text-primary)] bg-[var(--glass-bg-active)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`h-5 w-5 ${isActive ? 'text-[var(--accent)]' : ''}`}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
