import type { SyntheticEvent } from 'react';

export const FALLBACK_ARTWORK_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" fill="none">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="240" y2="240" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ff6b35" stop-opacity="0.82"/>
          <stop offset="52%" stop-color="#6366f1" stop-opacity="0.82"/>
          <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.85"/>
        </linearGradient>
      </defs>
      <rect width="240" height="240" rx="28" fill="url(#g)"/>
      <circle cx="120" cy="120" r="64" fill="#ffffff" fill-opacity="0.14"/>
      <path d="M142 74v66.5a21.5 21.5 0 1 1-14-20.1V93.5l-32 7.5v48.5a21.5 21.5 0 1 1-14-20.1V89.2c0-5.4 3.7-10.1 8.9-11.4l39.6-9.5c6.5-1.6 11.5 3.3 11.5 5.7Z" fill="#ffffff" fill-opacity="0.9"/>
    </svg>`,
  );

export function handleArtworkError(
  event: SyntheticEvent<HTMLImageElement>,
  mirrors?: string[],
): void {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === '1') return;

  if (mirrors && mirrors.length > 0 && img.src.startsWith('http')) {
    const nextIndex = Number(img.dataset.mirrorIdx ?? '0');
    if (nextIndex < mirrors.length) {
      try {
        const currentUrl = new URL(img.src);
        const mirrorOrigin = mirrors[nextIndex].replace(/\/+$/, '');
        if (mirrorOrigin.startsWith('https://')) {
          img.dataset.mirrorIdx = String(nextIndex + 1);
          const candidate = `${mirrorOrigin}${currentUrl.pathname}${currentUrl.search}`;
          if (candidate !== img.src) {
            img.src = candidate;
            return;
          }
        }
      } catch {
        // Переходимо до стандартної заглушки
      }
    }
  }

  img.dataset.fallbackApplied = '1';
  img.src = FALLBACK_ARTWORK_SVG;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatCount(count?: number): string {
  if (count === undefined || !Number.isFinite(count) || count < 0) {
    return '0';
  }
  if (count >= 1_000_000) {
    const val = (count / 1_000_000).toFixed(1).replace('.', ',').replace(/,0$/, '');
    return `${val} млн`;
  }
  if (count >= 1_000) {
    const val = (count / 1_000).toFixed(1).replace('.', ',').replace(/,0$/, '');
    return `${val} тис.`;
  }
  return Math.round(count).toLocaleString('uk-UA');
}

export function pluralizeUk(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.floor(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;

  if (mod100 >= 11 && mod100 <= 19) {
    return many;
  }
  if (mod10 === 1) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return few;
  }
  return many;
}

export function formatCountWithUnit(
  count: number | undefined,
  one: string,
  few: string,
  many: string,
): string {
  if (count === undefined || !Number.isFinite(count) || count < 0) {
    return `0 ${many}`;
  }
  if (count >= 1_000) {
    return `${formatCount(count)} ${many}`;
  }
  return `${formatCount(count)} ${pluralizeUk(count, one, few, many)}`;
}
