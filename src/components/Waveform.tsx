import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { getActiveAnalyser } from '../hooks/useAudio';
import { formatDuration } from '../utils/format';

export interface WaveformProps {
  trackId?: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  visualizerFallback: boolean;
  onSeek: (time: number) => void;
  variant?: 'compact' | 'expanded';
  disabled?: boolean;
}

function generateWaveformBars(seedText: string, count: number): number[] {
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    seed ^= seedText.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }

  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const norm = ((seed >>> 0) % 1000) / 1000;
    const envelope = 0.72 + 0.28 * Math.sin((i / count) * Math.PI);
    bars.push(0.24 + norm * 0.68 * envelope);
  }
  return bars;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export function Waveform({
  trackId = 'idle',
  currentTime,
  duration,
  isPlaying,
  visualizerFallback,
  onSeek,
  variant = 'compact',
  disabled = false,
}: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const barCount = variant === 'expanded' ? 64 : 48;
  const bars = useMemo(() => generateWaveformBars(trackId, barCount), [trackId, barCount]);

  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 320,
    height: variant === 'expanded' ? 68 : 34,
  });
  const [hoverInfo, setHoverInfo] = useState<{ ratio: number; x: number } | null>(null);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const isDraggingRef = useRef(false);

  const colorsRef = useRef({
    accent: '#ff6b35',
    hoverFill: 'rgba(255, 107, 53, 0.45)',
    idleFill: 'rgba(248, 250, 252, 0.26)',
  });

  // Відстежуємо розмір контейнера для чіткого рендеру з DPR
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Синхронізуємо кольори з поточною темою й акцентною палітрою
  useEffect(() => {
    const readColors = () => {
      const styles = getComputedStyle(document.documentElement);
      const accent = styles.getPropertyValue('--accent').trim() || '#ff6b35';
      const isLight = document.documentElement.dataset.theme === 'light';
      colorsRef.current = {
        accent,
        hoverFill: isLight ? 'rgba(15, 23, 42, 0.34)' : 'rgba(255, 255, 255, 0.48)',
        idleFill: isLight ? 'rgba(15, 23, 42, 0.18)' : 'rgba(255, 255, 255, 0.22)',
      };
    };

    readColors();
    const observer = new MutationObserver(readColors);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style'],
    });
    return () => observer.disconnect();
  }, [trackId]);

  const progressRatio =
    dragRatio !== null
      ? dragRatio
      : duration > 0
        ? clamp(currentTime / duration, 0, 1)
        : 0;

  const latestRef = useRef({
    progressRatio,
    hoverRatio: hoverInfo?.ratio ?? null,
    isPlaying,
    visualizerFallback,
    disabled,
  });

  latestRef.current = {
    progressRatio,
    hoverRatio: hoverInfo?.ratio ?? null,
    isPlaying,
    visualizerFallback,
    disabled,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(size.width * dpr));
    canvas.height = Math.max(1, Math.floor(size.height * dpr));

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const freqBuffer = new Uint8Array(64);
    let rafId = 0;

    const drawFrame = (timestamp: number) => {
      const {
        progressRatio: activeProgress,
        hoverRatio,
        isPlaying: playing,
        visualizerFallback: fallback,
        disabled: isDisabled,
      } = latestRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.width, size.height);

      const totalBars = bars.length;
      const gap = variant === 'expanded' ? 3 : 2;
      const barWidth = Math.max(2, (size.width - gap * (totalBars - 1)) / totalBars);
      const step = barWidth + gap;
      const maxBarHeight = size.height - 4;
      const reduceMotion = reducedMotionQuery.matches;
      const analyser = !fallback ? getActiveAnalyser() : null;

      if (playing && analyser) {
        analyser.getByteFrequencyData(freqBuffer);
      }

      const timeSec = timestamp / 1000;

      for (let i = 0; i < totalBars; i++) {
        let amplitude = bars[i];

        if (playing && !isDisabled) {
          if (!fallback && analyser) {
            const bin = Math.min(freqBuffer.length - 1, Math.floor((i / totalBars) * 42));
            const energy = freqBuffer[bin] / 255;
            amplitude = clamp(amplitude * 0.52 + energy * 0.78, 0.18, 1);
          } else if (!reduceMotion) {
            const wave = 0.72 + 0.28 * Math.sin(timeSec * 4.2 + i * 0.42);
            amplitude = clamp(amplitude * wave, 0.18, 1);
          }
        } else {
          amplitude = clamp(amplitude * 0.76, 0.16, 0.92);
        }

        const barHeight = Math.max(4, amplitude * maxBarHeight);
        const x = i * step;
        const y =
          variant === 'expanded'
            ? (size.height - barHeight) / 2
            : size.height - barHeight - 2;

        const barCenterRatio = (x + barWidth / 2) / size.width;

        if (!isDisabled && barCenterRatio <= activeProgress) {
          ctx.fillStyle = colorsRef.current.accent;
        } else if (
          !isDisabled &&
          hoverRatio !== null &&
          barCenterRatio <= hoverRatio &&
          barCenterRatio > activeProgress
        ) {
          ctx.fillStyle = colorsRef.current.hoverFill;
        } else {
          ctx.fillStyle = colorsRef.current.idleFill;
        }

        const radius = Math.min(barWidth / 2, 3);
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.fill();
      }

      if (playing && !isDisabled) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    };

    rafId = window.requestAnimationFrame(drawFrame);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [bars, size, variant, isPlaying, visualizerFallback, progressRatio, hoverInfo, disabled]);

  const computePointerPosition = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return { ratio: 0, x: 0 };
    const rect = el.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const ratio = rect.width > 0 ? clamp(x / rect.width, 0, 1) : 0;
    return { ratio, x };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    isDraggingRef.current = true;
    const { ratio, x } = computePointerPosition(event.clientX);
    setDragRatio(ratio);
    setHoverInfo({ ratio, x });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    const { ratio, x } = computePointerPosition(event.clientX);
    setHoverInfo({ ratio, x });
    if (isDraggingRef.current) {
      setDragRatio(ratio);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const { ratio } = computePointerPosition(event.clientX);
    setDragRatio(null);
    if (!disabled && duration > 0) {
      onSeek(ratio * duration);
    }
  };

  const handlePointerCancel = () => {
    isDraggingRef.current = false;
    setDragRatio(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    switch (event.code) {
      case 'ArrowLeft':
        event.preventDefault();
        onSeek(Math.max(0, currentTime - 5));
        break;
      case 'ArrowRight':
        event.preventDefault();
        onSeek(Math.min(duration, currentTime + 5));
        break;
      case 'Home':
        event.preventDefault();
        onSeek(0);
        break;
      case 'End':
        event.preventDefault();
        onSeek(duration);
        break;
      default:
        break;
    }
  };

  const tooltipLeft = hoverInfo ? clamp(hoverInfo.x, 26, Math.max(26, size.width - 26)) : 0;
  const hoverSeconds = hoverInfo && duration > 0 ? hoverInfo.ratio * duration : 0;

  return (
    <div
      ref={containerRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Смуга прогресу відтворення"
      aria-disabled={disabled}
      aria-valuemin={0}
      aria-valuemax={Math.max(0, Math.floor(duration))}
      aria-valuenow={Math.max(0, Math.floor(currentTime))}
      aria-valuetext={`${formatDuration(currentTime)} із ${formatDuration(duration)}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={() => {
        if (!isDraggingRef.current) setHoverInfo(null);
      }}
      onKeyDown={handleKeyDown}
      className={[
        'relative w-full select-none touch-none rounded-xl',
        variant === 'expanded' ? 'h-[68px]' : 'h-[34px]',
        disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />

      {hoverInfo && !disabled && duration > 0 && (
        <div
          aria-hidden="true"
          style={{ left: `${tooltipLeft}px` }}
          className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-full border border-[var(--glass-border)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-primary)] shadow-lg tabular-nums"
        >
          {formatDuration(hoverSeconds)}
        </div>
      )}
    </div>
  );
}
