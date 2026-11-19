import type { HTMLAttributes, PointerEvent, ReactNode } from 'react';

export interface GlassCardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  as?: 'div' | 'section' | 'article' | 'aside';
  interactive?: boolean;
  spotlight?: boolean;
  refract?: boolean;
  radius?: 'md' | 'lg' | 'xl';
}

const radiusClassMap: Record<NonNullable<GlassCardProps['radius']>, string> = {
  md: 'glass-radius-md',
  lg: 'glass-radius-lg',
  xl: 'glass-radius-xl',
};

export function GlassCard({
  children,
  className = '',
  as = 'div',
  interactive = false,
  spotlight = false,
  refract = false,
  radius = 'lg',
  onPointerMove,
  ...rest
}: GlassCardProps) {
  const Component = as;

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (spotlight) {
      const rect = event.currentTarget.getBoundingClientRect();
      event.currentTarget.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
      event.currentTarget.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
    }
    onPointerMove?.(event);
  };

  const classes = [
    'glass-card',
    radiusClassMap[radius],
    interactive ? 'glass-interactive' : '',
    spotlight ? 'glass-spotlight' : '',
    refract ? 'glass-refractable' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={classes} onPointerMove={handlePointerMove} {...rest}>
      {children}
    </Component>
  );
}
