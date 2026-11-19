export interface SkeletonBoxProps {
  className?: string;
}

export function SkeletonBox({ className = '' }: SkeletonBoxProps) {
  return <div aria-hidden="true" className={`skeleton-shimmer rounded-2xl ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Завантаження сторінки">
      <div className="glass-panel p-6 sm:p-8 space-y-4">
        <SkeletonBox className="h-5 w-36 rounded-full" />
        <SkeletonBox className="h-10 w-3/4 max-w-md" />
        <SkeletonBox className="h-4 w-full max-w-xl" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass-card p-5 space-y-3">
          <SkeletonBox className="h-36 w-full" />
          <SkeletonBox className="h-5 w-2/3" />
          <SkeletonBox className="h-4 w-1/2" />
        </div>
        <div className="glass-card p-5 space-y-3">
          <SkeletonBox className="h-36 w-full" />
          <SkeletonBox className="h-5 w-2/3" />
          <SkeletonBox className="h-4 w-1/2" />
        </div>
        <div className="glass-card p-5 space-y-3 hidden lg:block">
          <SkeletonBox className="h-36 w-full" />
          <SkeletonBox className="h-5 w-2/3" />
          <SkeletonBox className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}
