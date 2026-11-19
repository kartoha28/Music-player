import { Disc3, Library, Search, Settings, Sparkles, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';

const QUICK_LINKS = [
  {
    to: '/search',
    title: 'Пошук музики',
    description: 'Миттєвий пошук треків, артистів і плейлистів (Етап 2).',
    icon: Search,
  },
  {
    to: '/library',
    title: 'Моя бібліотека',
    description: 'Вподобані треки та власні плейлисти в localStorage (Етап 5).',
    icon: Library,
  },
  {
    to: '/settings',
    title: 'Тема та скло',
    description: 'Перевірте світлу й темну теми та інтенсивність Liquid Glass вже зараз.',
    icon: Settings,
  },
  {
    to: '/artist/demo',
    title: 'Сторінка артиста',
    description: 'Демо-маршрут /artist/:id для перевірки навігації.',
    icon: UserRound,
  },
  {
    to: '/playlist/demo',
    title: 'Сторінка плейлиста',
    description: 'Демо-маршрут /playlist/:id для перевірки навігації.',
    icon: Disc3,
  },
] as const;

export default function Home() {
  return (
    <div className="space-y-8">
      <GlassCard
        as="section"
        radius="xl"
        spotlight
        className="p-6 sm:p-10"
        aria-labelledby="home-hero-title"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3.5 py-1 text-xs font-semibold text-[var(--text-secondary)]">
          <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
          <span>Етап 1 · Каркас застосунку</span>
        </div>

        <h1
          id="home-hero-title"
          className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]"
        >
          Хвиля — Музика у стилі Liquid Glass
        </h1>

        <p className="mt-3 max-w-2xl text-sm sm:text-base leading-relaxed text-[var(--text-secondary)]">
          Базовий каркас проєкту розгорнуто: працюють HashRouter, ліниве завантаження сторінок,
          адаптивна навігація, токени дизайну Liquid Glass та автоматичний деплой на GitHub Pages.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/settings" className="no-underline">
            <GlassButton variant="primary" size="md">
              Перевірити тему та скло
            </GlassButton>
          </Link>
          <Link to="/search" className="no-underline">
            <GlassButton variant="glass" size="md">
              Перейти до пошуку
            </GlassButton>
          </Link>
        </div>
      </GlassCard>

      <section aria-labelledby="quick-routes-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            id="quick-routes-heading"
            className="text-xl font-semibold tracking-tight text-[var(--text-primary)]"
          >
            Навігація по маршрутах
          </h2>
          <span className="text-xs text-[var(--text-muted)]">HashRouter</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {QUICK_LINKS.map(({ to, title, description, icon: Icon }) => (
            <Link key={to} to={to} className="no-underline block group">
              <GlassCard
                interactive
                spotlight
                radius="md"
                className="h-full p-5 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--accent)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-mono text-[var(--text-muted)]">#{to}</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {description}
                  </p>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
