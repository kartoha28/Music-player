import { useEffect } from 'react';

interface Palette {
  ambient1: string;
  ambient2: string;
  ambient3: string;
  h1: number;
  s1: number;
  l1: number;
}

const DEFAULT_PALETTE: Palette = {
  ambient1: '#ff6b35',
  ambient2: '#6366f1',
  ambient3: '#06b6d4',
  h1: 16,
  s1: 90,
  l1: 60,
};

const paletteCache = new Map<string, Palette>();

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) {
    return [0, 0, l * 100];
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }

  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    [r, g, b] = [c, x, 0];
  } else if (h < 120) {
    [r, g, b] = [x, c, 0];
  } else if (h < 180) {
    [r, g, b] = [0, c, x];
  } else if (h < 240) {
    [r, g, b] = [0, x, c];
  } else if (h < 300) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (v: number) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function pickContrastText(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l);
  const lum = relativeLuminance(r, g, b);
  const whiteContrast = 1.05 / (lum + 0.05);
  const darkContrast = (lum + 0.05) / 0.05;
  return whiteContrast >= darkContrast ? '#ffffff' : '#0b1120';
}

function generateFallbackPalette(seedText: string): Palette {
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const h1 = (hash >>> 0) % 360;
  const h2 = (h1 + 52) % 360;
  const h3 = (h1 + 168) % 360;
  return {
    ambient1: `hsl(${h1}, 78%, 54%)`,
    ambient2: `hsl(${h2}, 72%, 50%)`,
    ambient3: `hsl(${h3}, 74%, 46%)`,
    h1,
    s1: 78,
    l1: 56,
  };
}

function extractPaletteFromPixels(data: Uint8ClampedArray, seedText: string): Palette {
  const binCount = 24;
  const binWeight = new Float64Array(binCount);
  const binH = new Float64Array(binCount);
  const binS = new Float64Array(binCount);
  const binL = new Float64Array(binCount);

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue;

    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (l < 12 || l > 88 || s < 18) continue;

    const bin = Math.min(binCount - 1, Math.floor((h % 360) / (360 / binCount)));
    const weight = (s / 100) * 2.2 * (1 - Math.abs(l - 50) / 65);
    binWeight[bin] += weight;
    binH[bin] += h * weight;
    binS[bin] += s * weight;
    binL[bin] += l * weight;
  }

  let bestBin = -1;
  let bestWeight = 0;
  for (let i = 0; i < binCount; i++) {
    if (binWeight[i] > bestWeight) {
      bestWeight = binWeight[i];
      bestBin = i;
    }
  }

  if (bestBin < 0 || bestWeight <= 0) {
    return generateFallbackPalette(seedText);
  }

  const h1 = Math.round(binH[bestBin] / bestWeight) % 360;
  const s1 = clamp(Math.round(binS[bestBin] / bestWeight), 60, 88);
  const l1 = clamp(Math.round(binL[bestBin] / bestWeight), 44, 64);

  let secondBin = -1;
  let secondWeight = 0;
  for (let i = 0; i < binCount; i++) {
    const hCandidate = i * (360 / binCount);
    const diff = Math.min(Math.abs(hCandidate - h1), 360 - Math.abs(hCandidate - h1));
    if (diff >= 45 && binWeight[i] > secondWeight) {
      secondWeight = binWeight[i];
      secondBin = i;
    }
  }

  const h2 =
    secondBin >= 0 && secondWeight > bestWeight * 0.12
      ? Math.round(binH[secondBin] / secondWeight) % 360
      : (h1 + 54) % 360;

  const h3 = (h1 + 165) % 360;

  return {
    ambient1: `hsl(${h1}, ${s1}%, 54%)`,
    ambient2: `hsl(${h2}, 70%, 48%)`,
    ambient3: `hsl(${h3}, 72%, 45%)`,
    h1,
    s1,
    l1,
  };
}

function loadCorsImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
}

async function sampleArtworkPalette(
  artworkUrl: string,
  mirrors: string[] | undefined,
  seedText: string,
): Promise<Palette> {
  const candidates: string[] = [artworkUrl];

  if (mirrors && mirrors.length > 0 && artworkUrl.startsWith('http')) {
    try {
      const parsed = new URL(artworkUrl);
      for (const mirror of mirrors.slice(0, 2)) {
        const origin = mirror.replace(/\/+$/, '');
        if (origin.startsWith('https://')) {
          candidates.push(`${origin}${parsed.pathname}${parsed.search}`);
        }
      }
    } catch {
      // Ігноруємо невалідний URL
    }
  }

  for (const candidate of candidates) {
    try {
      const img = await loadCorsImage(candidate);
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;

      ctx.drawImage(img, 0, 0, 32, 32);
      const imageData = ctx.getImageData(0, 0, 32, 32).data;
      return extractPaletteFromPixels(imageData, seedText);
    } catch {
      // Переходимо до наступного дзеркала або фолбеку
    }
  }

  return generateFallbackPalette(seedText);
}

function applyPaletteToDocument(palette: Palette): void {
  const root = document.documentElement;
  const isLight = root.dataset.theme === 'light';

  if (palette === DEFAULT_PALETTE) {
    root.style.setProperty('--ambient-1', DEFAULT_PALETTE.ambient1);
    root.style.setProperty('--ambient-2', DEFAULT_PALETTE.ambient2);
    root.style.setProperty('--ambient-3', DEFAULT_PALETTE.ambient3);
    root.style.setProperty('--accent', isLight ? '#d9480f' : '#ff6b35');
    root.style.setProperty('--accent-contrast', '#ffffff');
    root.style.setProperty('--accent-soft', 'rgba(255, 107, 53, 0.22)');
    return;
  }

  const accentSat = clamp(palette.s1, 68, 88);
  const accentLight = isLight
    ? clamp(palette.l1, 36, 46)
    : clamp(palette.l1, 52, 62);
  const accent = `hsl(${palette.h1}, ${accentSat}%, ${accentLight}%)`;

  root.style.setProperty('--ambient-1', palette.ambient1);
  root.style.setProperty('--ambient-2', palette.ambient2);
  root.style.setProperty('--ambient-3', palette.ambient3);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-contrast', pickContrastText(palette.h1, accentSat, accentLight));
  root.style.setProperty('--accent-soft', `hsla(${palette.h1}, ${accentSat}%, 55%, 0.24)`);
}

export function useDominantColor(
  artworkUrl?: string,
  mirrors?: string[],
  trackId?: string,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled || !artworkUrl || !artworkUrl.startsWith('http')) {
      applyPaletteToDocument(DEFAULT_PALETTE);
      return;
    }

    const cacheKey = trackId || artworkUrl;
    let activePalette: Palette = DEFAULT_PALETTE;
    let cancelled = false;

    const cached = paletteCache.get(cacheKey);
    if (cached) {
      activePalette = cached;
      applyPaletteToDocument(cached);
    } else {
      void sampleArtworkPalette(artworkUrl, mirrors, cacheKey).then((palette) => {
        if (cancelled) return;
        paletteCache.set(cacheKey, palette);
        activePalette = palette;
        applyPaletteToDocument(palette);
      });
    }

    const themeObserver = new MutationObserver(() => {
      if (!cancelled) {
        applyPaletteToDocument(activePalette);
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      cancelled = true;
      themeObserver.disconnect();
    };
  }, [artworkUrl, mirrors, trackId, enabled]);
}
