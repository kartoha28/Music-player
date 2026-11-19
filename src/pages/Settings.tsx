import {
  Download,
  Keyboard,
  Monitor,
  Moon,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Upload,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';
import { useLibraryStore } from '../store/libraryStore';
import {
  useSettingsStore,
  type GlassIntensity,
  type ThemePref,
} from '../store/settingsStore';
import { formatCountWithUnit } from '../utils/format';

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

const HOTKEY_ITEMS = [
  { key: 'Пробіл', action: 'Відтворити / Пауза' },
  { key: '← / →', action: 'Перемотування на 5 секунд' },
  { key: '↑ / ↓', action: 'Гучність ±5%' },
  { key: 'M', action: 'Вимкнути / увімкнути звук' },
  { key: 'N / P', action: 'Наступний / попередній трек' },
] as const;

export default function Settings() {
  const theme = useSettingsStore((s) => s.theme);
  const glassIntensity = useSettingsStore((s) => s.glassIntensity);
  const refractionEnabled = useSettingsStore((s) => s.refractionEnabled);
  const dynamicBackground = useSettingsStore((s) => s.dynamicBackground);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setGlassIntensity = useSettingsStore((s) => s.setGlassIntensity);
  const setRefractionEnabled = useSettingsStore((s) => s.setRefractionEnabled);
  const setDynamicBackground = useSettingsStore((s) => s.setDynamicBackground);

  const likedCount = useLibraryStore((s) => s.likedTracks.length);
  const playlistCount = useLibraryStore((s) => s.playlists.length);
  const exportLibrary = useLibraryStore((s) => s.exportLibrary);
  const importLibrary = useLibraryStore((s) => s.importLibrary);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const handleExport = () => {
    const payload = exportLibrary();
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const dateStamp = new Date().toISOString().slice(0, 10);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `hvylia-library-${dateStamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    setStatusMsg({
      type: 'ok',
      text: `Бібліотеку експортовано (${formatCountWithUnit(
        payload.likedTracks.length,
        'лайк',
        'лайки',
        'лайків',
      )}, ${formatCountWithUnit(payload.playlists.length, 'плейлист', 'плейлисти', 'плейлистів')}).`,
    });
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const summary = importLibrary(parsed, importMode);
      setStatusMsg({
        type: 'ok',
        text: `Імпорт завершено (${importMode === 'merge' ? 'об’єднано' : 'замінено'}): ${formatCountWithUnit(
          summary.likedCount,
          'трек',
          'треки',
          'треків',
        )} та ${formatCountWithUnit(
          summary.playlistCount,
          'плейлист',
          'плейлисти',
          'плейлистів',
        )}.`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text:
          err instanceof Error && err.message
            ? err.message
            : 'Не вдалося прочитати JSON-файл бібліотеки.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Налаштування
        </h1>
        <p className="text-sm sm:text-base text-[var(--text-secondary)]">
          Керування темою оформлення, ефектами Liquid Glass та резервним копіюванням бібліотеки.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Тема оформлення */}
        <GlassCard radius="xl" className="p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="m-0 text-lg font-semibold text-[var(--text-primary)]">
              Тема оформлення
            </h2>
            <p className="m-0 text-sm text-[var(--text-secondary)]">
              Оберіть темну, світлу або автоматичну тему згідно з налаштуваннями системи.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5" role="group" aria-label="Тема оформлення">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
              const active = theme === value;
              return (
                <GlassButton
                  key={value}
                  variant={active ? 'primary' : 'glass'}
                  size="md"
                  aria-pressed={active}
                  onClick={() => setTheme(value)}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{label}</span>
                </GlassButton>
              );
            })}
          </div>
        </GlassCard>

        {/* Інтенсивність скла */}
        <GlassCard radius="xl" className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="m-0 text-lg font-semibold text-[var(--text-primary)]">
                Інтенсивність скла
              </h2>
              <p className="m-0 text-sm text-[var(--text-secondary)]">
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
              const active = glassIntensity === value;
              return (
                <GlassButton
                  key={value}
                  variant={active ? 'primary' : 'glass'}
                  size="md"
                  aria-pressed={active}
                  onClick={() => setGlassIntensity(value)}
                >
                  <span>{label}</span>
                  <span className="text-xs opacity-75">({hint})</span>
                </GlassButton>
              );
            })}
          </div>
        </GlassCard>

        {/* Візуальні ефекти */}
        <GlassCard radius="xl" className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="m-0 text-lg font-semibold text-[var(--text-primary)]">
                Ефекти Liquid Glass
              </h2>
              <p className="m-0 text-sm text-[var(--text-secondary)]">
                Налаштування динамічної палітри та заломлення світла.
              </p>
            </div>
            <Sparkles
              className="h-5 w-5 text-[var(--accent)] shrink-0 mt-1"
              aria-hidden="true"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--glass-border-subtle)] bg-[var(--glass-bg)] px-4 py-3">
              <div>
                <p className="m-0 text-sm font-semibold text-[var(--text-primary)]">
                  Динамічний фон з обкладинки
                </p>
                <p className="m-0 text-xs text-[var(--text-secondary)]">
                  Плавна адаптація градієнтних плям і акценту під поточний трек.
                </p>
              </div>
              <GlassButton
                variant={dynamicBackground ? 'primary' : 'glass'}
                size="sm"
                role="switch"
                aria-checked={dynamicBackground}
                onClick={() => setDynamicBackground(!dynamicBackground)}
              >
                {dynamicBackground ? 'Увімкнено' : 'Вимкнено'}
              </GlassButton>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--glass-border-subtle)] bg-[var(--glass-bg)] px-4 py-3">
              <div>
                <p className="m-0 text-sm font-semibold text-[var(--text-primary)]">
                  Заломлення скла (SVG-фільтр)
                </p>
                <p className="m-0 text-xs text-[var(--text-secondary)]">
                  М’який оптичний блік на ключових панелях із фолбеком у браузерах без підтримки.
                </p>
              </div>
              <GlassButton
                variant={refractionEnabled ? 'primary' : 'glass'}
                size="sm"
                role="switch"
                aria-checked={refractionEnabled}
                onClick={() => setRefractionEnabled(!refractionEnabled)}
              >
                {refractionEnabled ? 'Увімкнено' : 'Вимкнено'}
              </GlassButton>
            </div>
          </div>
        </GlassCard>

        {/* Експорт та імпорт бібліотеки */}
        <GlassCard radius="xl" className="p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="m-0 text-lg font-semibold text-[var(--text-primary)]">
              Бібліотека в JSON
            </h2>
            <p className="m-0 text-sm text-[var(--text-secondary)]">
              Зараз збережено: {formatCountWithUnit(likedCount, 'вподобаний трек', 'вподобані треки', 'вподобаних треків')} та{' '}
              {formatCountWithUnit(playlistCount, 'плейлист', 'плейлисти', 'плейлистів')}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-[var(--text-muted)]">Режим імпорту:</span>
            <GlassButton
              variant={importMode === 'merge' ? 'primary' : 'glass'}
              size="sm"
              aria-pressed={importMode === 'merge'}
              onClick={() => setImportMode('merge')}
            >
              Об’єднати
            </GlassButton>
            <GlassButton
              variant={importMode === 'replace' ? 'primary' : 'glass'}
              size="sm"
              aria-pressed={importMode === 'replace'}
              onClick={() => setImportMode('replace')}
            >
              Замінити
            </GlassButton>
          </div>

          <div className="flex flex-wrap gap-3">
            <GlassButton variant="primary" size="md" onClick={handleExport}>
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Експортувати в JSON</span>
            </GlassButton>

            <GlassButton
              variant="glass"
              size="md"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span>Імпортувати JSON</span>
            </GlassButton>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
              aria-label="Обрати JSON-файл бібліотеки"
            />
          </div>

          {statusMsg && (
            <div
              role="status"
              className={`rounded-2xl border px-4 py-2.5 text-xs sm:text-sm ${
                statusMsg.type === 'error'
                  ? 'border-rose-500/50 bg-rose-500/15 text-[var(--text-primary)]'
                  : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-primary)]'
              }`}
            >
              {statusMsg.text}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Довідка гарячих клавіш */}
      <GlassCard radius="xl" className="p-6 space-y-3">
        <div className="flex items-center gap-2.5">
          <Keyboard className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
          <h2 className="m-0 text-lg font-semibold text-[var(--text-primary)]">
            Гарячі клавіші плеєра
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {HOTKEY_ITEMS.map(({ key, action }) => (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--glass-border-subtle)] bg-[var(--glass-bg)] px-3.5 py-2.5 text-sm"
            >
              <span className="text-[var(--text-secondary)]">{action}</span>
              <kbd className="rounded-lg border border-[var(--glass-border)] bg-[var(--bg-elevated)] px-2 py-0.5 text-xs font-semibold text-[var(--text-primary)]">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
