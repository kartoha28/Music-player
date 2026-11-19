export interface SCPlayProgressEvent {
  soundId: number;
  loadedProgress: number;
  currentPosition: number;
  relativePosition: number;
}

export interface SCSound {
  id?: number;
  title?: string;
  duration?: number;
  embeddable_by?: string;
  policy?: string;
  user?: {
    username?: string;
  };
}

export interface SCWidgetEvents {
  READY: 'ready';
  PLAY: 'play';
  PAUSE: 'pause';
  FINISH: 'finish';
  PLAY_PROGRESS: 'playProgress';
  SEEK: 'seek';
  ERROR: 'error';
  LOAD_PROGRESS: 'loadProgress';
}

export interface SCWidget {
  bind(event: string, listener: (payload?: unknown) => void): void;
  unbind(event: string): void;
  play(): void;
  pause(): void;
  toggle(): void;
  seekTo(milliseconds: number): void;
  setVolume(volume: number): void;
  getDuration(callback: (milliseconds: number) => void): void;
  getPosition(callback: (milliseconds: number) => void): void;
  getCurrentSound(callback: (sound: SCSound | null) => void): void;
  isPaused(callback: (paused: boolean) => void): void;
}

export interface SCNamespace {
  Widget: {
    (iframeElement: HTMLIFrameElement | string): SCWidget;
    Events: SCWidgetEvents;
  };
}

declare global {
  interface Window {
    SC?: SCNamespace;
  }
}

const SC_API_SCRIPT_SRC = 'https://w.soundcloud.com/player/api.js';
let apiPromise: Promise<SCNamespace> | null = null;

export function loadSoundCloudWidgetApi(): Promise<SCNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('SoundCloud Widget API доступний лише у браузері.'));
  }

  if (window.SC?.Widget) {
    return Promise.resolve(window.SC);
  }

  if (apiPromise) {
    return apiPromise;
  }

  apiPromise = new Promise<SCNamespace>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SC_API_SCRIPT_SRC}"]`,
    );
    const script = existing ?? document.createElement('script');

    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timer);
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      apiPromise = null;
      reject(new Error(message));
    };

    const handleLoad = () => {
      if (settled) return;
      if (window.SC?.Widget) {
        settled = true;
        cleanup();
        resolve(window.SC);
      } else {
        fail('Не вдалося ініціалізувати SoundCloud Widget API.');
      }
    };

    const handleError = () => {
      fail('Не вдалося завантажити SoundCloud Widget API. Перевірте інтернет або розширення браузера.');
    };

    const timer = window.setTimeout(() => {
      fail('Час очікування SoundCloud Widget API вичерпано. Перевірте інтернет або блокувальник реклами.');
    }, 10_000);

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    if (!existing) {
      script.src = SC_API_SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    } else if (window.SC?.Widget) {
      handleLoad();
    }
  });

  return apiPromise;
}
