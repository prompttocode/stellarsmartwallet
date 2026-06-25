import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheEntry<T> = {
  data: T;
  savedAt: number;
  version: number;
};

const CACHE_PREFIX = 'privy-cache-v1';
const DEFAULT_VERSION = 1;

function buildKey(key: string) {
  return `${CACHE_PREFIX}:${key}`;
}

export async function cacheGet<T>(
  key: string,
  ttlMs: number,
  version = DEFAULT_VERSION,
): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(buildKey(key));

    if (!raw) {
      return null;
    }

    const entry = JSON.parse(raw) as CacheEntry<T>;

    if (entry.version !== version) {
      await AsyncStorage.removeItem(buildKey(key));
      return null;
    }

    if (Date.now() - Number(entry.savedAt || 0) > ttlMs) {
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  data: T,
  version = DEFAULT_VERSION,
): Promise<void> {
  try {
    const entry: CacheEntry<T> = {
      data,
      savedAt: Date.now(),
      version,
    };

    await AsyncStorage.setItem(buildKey(key), JSON.stringify(entry));
  } catch {
    // Cache is best-effort; ignore write failures.
  }
}

export async function cacheRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(buildKey(key));
  } catch {
    // Best-effort.
  }
}

export async function cacheGetWithRefresh<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  options: {
    onUpdate?: (data: T) => void;
    version?: number;
  } = {},
): Promise<{ data: T | null; fromCache: boolean }> {
  const version = options.version ?? DEFAULT_VERSION;
  const cached = await cacheGet<T>(key, ttlMs, version);

  if (cached !== null) {
    fetcher()
      .then(fresh => {
        cacheSet(key, fresh, version).catch(() => null);
        options.onUpdate?.(fresh);
      })
      .catch(() => null);

    return { data: cached, fromCache: true };
  }

  try {
    const fresh = await fetcher();
    await cacheSet(key, fresh, version);
    return { data: fresh, fromCache: false };
  } catch {
    return { data: null, fromCache: false };
  }
}
