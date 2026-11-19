import { UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';

export default function Artist() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-6">
      <GlassCard radius="xl" className="p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--accent)]">
            <UserRound className="h-8 w-8" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Профіль артиста
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              Артист: {id ?? 'невідомо'}
            </h1>
          </div>
        </div>

        <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-xl">
          На Етапі 5 тут відображатимуться аватар, обкладинка профілю, біографія, кнопка «Грати
          все» та повний список треків артиста.
        </p>

        <Link to="/" className="inline-block no-underline">
          <GlassButton variant="glass" size="sm">
            На головну
          </GlassButton>
        </Link>
      </GlassCard>
    </div>
  );
}
