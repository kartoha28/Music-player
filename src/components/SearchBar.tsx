import { Loader2, Search, X } from 'lucide-react';
import { useRef } from 'react';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  isLoading?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Пошук треків, артистів або плейлистів...',
  ariaLabel = 'Пошук музики',
  isLoading = false,
  autoFocus = false,
  className = '',
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div
      role="search"
      className={`glass-surface glass-radius-lg flex items-center gap-3 px-4 py-3 transition-colors focus-within:border-[var(--accent)] ${className}`}
    >
      <Search className="h-5 w-5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />

      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        className="w-full min-w-0 bg-transparent border-0 text-sm sm:text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
      />

      {isLoading && (
        <Loader2
          className="h-4 w-4 shrink-0 text-[var(--accent)] motion-safe:animate-spin"
          aria-label="Триває пошук"
        />
      )}

      {value.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Очистити пошук"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
