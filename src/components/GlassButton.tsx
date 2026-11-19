import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

export interface GlassButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children?: ReactNode;
  variant?: 'glass' | 'primary' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const variantClasses: Record<NonNullable<GlassButtonProps['variant']>, string> = {
  glass:
    'glass-button glass-interactive text-[var(--text-primary)]',
  primary:
    'rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] border border-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_28px_var(--accent-soft)] hover:brightness-110',
  ghost:
    'rounded-full bg-transparent border border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]',
};

const sizeClasses: Record<NonNullable<GlassButtonProps['size']>, string> = {
  sm: 'px-3.5 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
  icon: 'h-10 w-10 p-0',
};

export function GlassButton({
  children,
  variant = 'glass',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: GlassButtonProps) {
  return (
    <motion.button
      type={type}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className={[
        'inline-flex items-center justify-center font-medium select-none cursor-pointer',
        'transition-colors duration-150 disabled:opacity-45 disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
