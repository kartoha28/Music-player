export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException('Запит скасовано', 'AbortError'));
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException('Запит скасовано', 'AbortError'));
    };

    signal.addEventListener('abort', onAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

export class MemoryCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs = DEFAULT_CACHE_TTL_MS) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: { ttlMs?: number; forceRefresh?: boolean; signal?: AbortSignal },
  ): Promise<T> {
    if (options?.signal?.aborted) {
      throw new DOMException('Запит скасовано', 'AbortError');
    }

    if (!options?.forceRefresh) {
      const cached = this.get<T>(key);
      if (cached !== undefined) {
        return cached;
      }
    }

    let promise = this.inflight.get(key) as Promise<T> | undefined;
    if (!promise) {
      promise = fetcher()
        .then((data) => {
          this.set(key, data, options?.ttlMs ?? this.defaultTtlMs);
          return data;
        })
        .finally(() => {
          this.inflight.delete(key);
        });

      this.inflight.set(key, promise);
    }

    return raceWithAbort(promise, options?.signal);
  }

  deletePrefix(prefix: string): void {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
      }
    }
  }

  clear(): void {
    this.entries.clear();
    this.inflight.clear();
  }
}

export class ProviderHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ProviderHttpError';
    this.status = status;
  }
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Запит скасовано', 'AbortError'));
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Запит скасовано', 'AbortError'));
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface FetchRetryOptions {
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
}

const RETRY_DELAYS_MS = [400, 1000];

export async function fetchJsonWithRetry<T>(
  url: string,
  options: FetchRetryOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const retries = options.retries ?? 2;
  const externalSignal = options.signal;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (externalSignal?.aborted) {
      throw new DOMException('Запит скасовано', 'AbortError');
    }

    const timeoutController = new AbortController();
    let timedOut = false;

    const onExternalAbort = () => {
      timeoutController.abort(externalSignal?.reason);
    };

    externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

    const timer = setTimeout(() => {
      timedOut = true;
      timeoutController.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: timeoutController.signal,
      });

      if (!response.ok) {
        const shouldRetry = response.status === 429 || response.status >= 500;
        const err = new ProviderHttpError(
          response.status,
          `Помилка сервера (${response.status})`,
        );
        if (!shouldRetry || attempt === retries) {
          throw err;
        }
        lastError = err;
      } else {
        return (await response.json()) as T;
      }
    } catch (error) {
      if (externalSignal?.aborted) {
        throw new DOMException('Запит скасовано', 'AbortError');
      }
      if (error instanceof ProviderHttpError) {
        if (error.status !== 429 && error.status < 500) {
          throw error;
        }
        lastError = error;
      } else if (timedOut || isAbortError(error)) {
        lastError = new Error('Час очікування відповіді від сервера вичерпано');
      } else {
        lastError = error;
      }

      if (attempt === retries) {
        throw lastError;
      }
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    }

    const delay = RETRY_DELAYS_MS[attempt] ?? 1000;
    await sleep(delay, externalSignal);
  }

  throw lastError instanceof Error ? lastError : new Error('Не вдалося виконати запит');
}
