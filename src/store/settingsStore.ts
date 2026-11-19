import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePref = 'dark' | 'light' | 'system';
export type GlassIntensity = 'low' | 'medium' | 'high';

export interface SettingsValues {
  theme: ThemePref;
  glassIntensity: GlassIntensity;
  refractionEnabled: boolean;
  dynamicBackground: boolean;
}

interface SettingsState extends SettingsValues {
  setTheme: (theme: ThemePref) => void;
  setGlassIntensity: (intensity: GlassIntensity) => void;
  setRefractionEnabled: (enabled: boolean) => void;
  setDynamicBackground: (enabled: boolean) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: SettingsValues = {
  theme: 'dark',
  glassIntensity: 'medium',
  refractionEnabled: true,
  dynamicBackground: true,
};

export function resolveTheme(theme: ThemePref): 'dark' | 'light' {
  if (theme === 'system') {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }
  return theme === 'light' ? 'light' : 'dark';
}

export function applySettingsToDom(settings: Pick<SettingsValues, 'theme' | 'glassIntensity' | 'refractionEnabled'>): void {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(settings.theme);

  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.glass = settings.glassIntensity;
  document.documentElement.dataset.refraction = settings.refractionEnabled ? 'on' : 'off';

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', resolved === 'light' ? '#e9eff8' : '#070a12');
  }
}

const settingsStorage = {
  getItem: (name: string): string | null => {
    const raw = localStorage.getItem(name);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      // Міграція з плоского формату Етапу 1 до формату Zustand persist
      if (parsed && !('state' in parsed) && ('theme' in parsed || 'glassIntensity' in parsed)) {
        return JSON.stringify({
          state: {
            theme: parsed.theme ?? DEFAULT_SETTINGS.theme,
            glassIntensity: parsed.glassIntensity ?? DEFAULT_SETTINGS.glassIntensity,
            refractionEnabled:
              typeof parsed.refractionEnabled === 'boolean'
                ? parsed.refractionEnabled
                : DEFAULT_SETTINGS.refractionEnabled,
            dynamicBackground:
              typeof parsed.dynamicBackground === 'boolean'
                ? parsed.dynamicBackground
                : DEFAULT_SETTINGS.dynamicBackground,
          },
          version: 0,
        });
      }
      return raw;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    localStorage.setItem(name, value);
  },
  removeItem: (name: string): void => {
    localStorage.removeItem(name);
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,

      setTheme: (theme) => {
        set({ theme });
        applySettingsToDom({ ...get(), theme });
      },

      setGlassIntensity: (glassIntensity) => {
        set({ glassIntensity });
        applySettingsToDom({ ...get(), glassIntensity });
      },

      setRefractionEnabled: (refractionEnabled) => {
        set({ refractionEnabled });
        applySettingsToDom({ ...get(), refractionEnabled });
      },

      setDynamicBackground: (dynamicBackground) => {
        set({ dynamicBackground });
      },

      resetSettings: () => {
        set(DEFAULT_SETTINGS);
        applySettingsToDom(DEFAULT_SETTINGS);
      },
    }),
    {
      name: 'wave-settings',
      storage: createJSONStorage(() => settingsStorage),
      partialize: (state) => ({
        theme: state.theme,
        glassIntensity: state.glassIntensity,
        refractionEnabled: state.refractionEnabled,
        dynamicBackground: state.dynamicBackground,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          applySettingsToDom(state);
        }
      },
    },
  ),
);
