import { Search as SearchIcon } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';

export default function Search() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Пошук</h1>
        <p className="text-sm sm:text-base text-[var(--text-secondary)]">
          Пошук треків, артистів і плейлистів з легальних відкритих каталогів.
        </p>
      </header>

      <GlassCard radius="xl" className="p-6 sm:p-8 flex flex-col items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--accent)]">
          <SearchIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Інтеграція Audius API — на Етапі 2
        </h2>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)] max-w-xl">
          Тут з’явиться рядок миттєвого пошуку (debounce 300 мс) та вкладки «Треки», «Артисти» й
          «Плейлисти» з кешуванням відповідей.
        </p>
      </GlassCard>
    </div>
  );
}
