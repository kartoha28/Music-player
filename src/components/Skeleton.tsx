import { AlertCircle, Music2, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { GlassButton } from './GlassButton';
import { GlassCard } from './GlassCard';

export interface SkeletonBoxProps {
  className?: string;
}

export function SkeletonBox({ className = '' }: SkeletonBoxProps) {
  return <div aria-hidden="true" className={`skeleton-shimmer rounded-2xl ${className}`} />;
}

export function HeroSkeleton() {
  return (
    <div
      className="glass-panel p-6 sm:p-8 lg:p-10 flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center"
      aria-busy="true"
      aria-label="Завантаження трендового треку"
    >
      <SkeletonBox className="w-full max-w-[240px] sm:w-56 md:w-64 aspect-square rounded-3xl shrink-0" />
      <div className="flex-1 w-full space-y-4">
        <SkeletonBox className="h-6 w-36 rounded-full" />
        <SkeletonBox className="h-9 w-3/4 max-w-md" />
        <SkeletonBox className="h-5 w-48" />
        <div className="flex gap-3 pt-2">
          <SkeletonBox className="h-11 w-36 rounded-full" />
          <SkeletonBox className="h-11 w-40 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function TrackCardSkeleton() {
  return (
    <div className="glass-card glass-radius-md p-3.5 space-y-3" aria-hidden="true">
      <SkeletonBox className="w-full aspect-square rounded-2xl" />
      <div className="space-y-2 px-0.5">
        <SkeletonBox className="h-4 w-4/5" />
        <SkeletonBox className="h-3.5 w-3/5" />
      </div>
    </div>
  );
}

export function TrackRowSkeleton() {
  return (
    <div
      className="glass-card glass-radius-md px-3.5 py-2.5 flex items-center gap-3.5"
      aria-hidden="true"
    >
      <SkeletonBox className="h-12 w-12 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <SkeletonBox className="h-4 w-2/5" />
        <SkeletonBox className="h-3 w-1/4" />
      </div>
      <SkeletonBox className="h-4 w-12 shrink-0" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Завантаження сторінки">
      <HeroSkeleton />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <TrackCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Не вдалося завантажити дані',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <GlassCard radius="xl" className="p-6 sm:p-8 flex flex-col items-start gap-4" role="alert">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-400/35 bg-rose-500/15 text-rose-400 shrink-0">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">{message}</p>
        </div>
      </div>

      {onRetry && (
        <GlassButton variant="primary" size="md" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span>Спробувати ще</span>
        </GlassButton>
      )}
    </GlassCard>
  );
}

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <GlassCard radius="xl" className="p-6 sm:p-8 flex flex-col items-start gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--accent)]">
        {icon ?? <Music2 className="h-5 w-5" aria-hidden="true" />}
      </span>
      <div className="space-y-1">
        <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)] max-w-xl">
          {description}
        </p>
      </div>
      {action && <div className="pt-1">{action}</div>}
    </GlassCard>
  );
}

export interface StageNoticeProps {
  message: string | null;
}

export function StageNotice({ message }: StageNoticeProps) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(var(--mobile-nav-height)+var(--player-bar-height)+0.75rem)] lg:bottom-[calc(var(--player-bar-height)+1.75rem)] right-4 left-4 sm:left-auto sm:max-w-md z-50 pointer-events-none"
    >
      <div className="glass-panel-strong px-4 py-3 text-sm font-medium text-[var(--text-primary)] shadow-2xl border border-[var(--glass-border)]">
        {message}
      </div>
    </div>
  );
}
