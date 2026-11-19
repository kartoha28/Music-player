import { Monitor, Moon, SlidersHorizontal, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';

type ThemePref = 'dark' | 'light' | 'system';
type GlassIntensity = 'low' | 'medium' | 'high';

interface QuickSettings {
  theme: ThemePref;
  glassIntensity: GlassIntensity;
}

const STORAGE_KEY = 'wave-settings';

function readStoredSettings(): QuickSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { theme: 'dark', glassIntensity: 'medium' };
    const parsed = JSON.parse(raw) as Partial<QuickSettings> & {
      state?: Partial<QuickSettings>;
    };
    const src = parsed.state ?? parsed;
    const theme: ThemePref =
      src.theme === 'light' || src.theme === 'system' || src.theme === 'dark' ? src.theme : 'dark';
    const glassIntensity: GlassIntensity =
      src.glassIntensity === 'low' ||
      src.glassIntensity === 'high' ||
      src.glassIntensity === 'medium'
        ? src.glassIntensity
        : 'medium';
    return { theme, glassIntensity };
  } catch {
    return { theme: 'dark', glassIntensity: 'medium' };
  }
}

function applyThemeToDom(theme: ThemePref, glassIntensity: GlassIntensity) {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : theme;

  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.glass = glassIntensity;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', resolved === 'light' ? '#e9eff8' : '#070a12');
  }
}

const THEME_OPTIONS: Array<{ value: ThemePref; label: string; icon: typeof Moon }> = [
  { value: 'dark', label: 'Темна', icon: Moon },
  { value: 'light', label: 'Світла', icon: Sun },
  { value: 'system', label: 'Системна', icon: Monitor },
];

const GLASS_OPTIONS: Array<{ value: GlassIntensity; label: string; hint: string }> = [
  { value: 'low', label: 'Легка', hint: '14 px' },
  { value: 'medium', label: 'Стандартна', hint: '24 px' },
  { value: 'high', label: 'Максимальна', hint: '36 px' },
];

export default function Settings() {
  const [settings, setSettings] = useState<QuickSettings>(readStoredSettings);

  useEffect(() => {
    applyThemeToDom(settings.theme, settings.glassIntensity);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ігноруємо помилку квоти або приватного режиму
    }
  }, [settings]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Налаштування
        </h1>
        <p className="text-sm sm:text-base text-[var(--text-secondary)]">
          Керування темою оформлення та інтенсивністю ефекту Liquid Glass.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GlassCard radius="xl" className="p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Тема оформлення</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Оберіть темну, світлу або автоматичну тему згідно з налаштуваннями системи.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5" role="group" aria-label="Тема оформлення">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
              const active = settings.theme === value;
              return (
                <GlassButton
                  key={value}
                  variant={active ? 'primary' : 'glass'}
                  size="md"
                  aria-pressed={active}
                  onClick={() => setSettings((prev) => ({ ...prev, theme: value }))}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{label}</span>
                </GlassButton>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard radius="xl" className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Інтенсивність скла
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Змінює радіус розмиття та насиченість backdrop-filter.
              </p>
            </div>
            <SlidersHorizontal
              className="h-5 w-5 text-[var(--text-muted)] shrink-0 mt-1"
              aria-hidden="true"
            />
          </div>

          <div className="flex flex-wrap gap-2.5" role="group" aria-label="Інтенсивність скла">
            {GLASS_OPTIONS.map(({ value, label, hint }) => {
              const active = settings.glassIntensity === value;
              return (
                <GlassButton
                  key={value}
                  variant={active ? 'primary' : 'glass'}
                  size="md"
                  aria-pressed={active}
                  onClick={() => setSettings((prev) => ({ ...prev, glassIntensity: value }))}
                >
                  <span>{label}</span>
                  <span className="text-xs opacity-75">({hint})</span>
                </GlassButton>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
