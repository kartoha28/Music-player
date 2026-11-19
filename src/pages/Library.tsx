import { Heart, ListMusic } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';

export default function Library() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Бібліотека
        </h1>
        <p className="text-sm sm:text-base text-[var(--text-secondary)]">
          Ваші вподобані треки та локальні плейлисти, збережені у браузері.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard radius="lg" className="p-6 space-y-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--accent)]">
            <Heart className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Вподобані треки</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Керування лайками та миттєвий доступ до улюбленої музики з’являться на Етапі 5.
          </p>
        </GlassCard>

        <GlassCard radius="lg" className="p-6 space-y-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--accent)]">
            <ListMusic className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Власні плейлисти</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Створення, перейменування та видалення власних добірок у localStorage.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
