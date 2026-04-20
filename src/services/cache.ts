import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX    = '@shiotrack_cache:';
const TTL_MS    = 5 * 60 * 1000; // 5 minutes default

interface CacheEntry<T> {
  data:      T;
  cachedAt:  number;
  ttl:       number;
}

export async function cacheSet<T>(key: string, data: T, ttlMs = TTL_MS): Promise<void> {
  const entry: CacheEntry<T> = { data, cachedAt: Date.now(), ttl: ttlMs };
  await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > entry.ttl) return null; // expired
    return entry.data;
  } catch {
    return null;
  }
}

export async function cacheClear(key: string): Promise<void> {
  await AsyncStorage.removeItem(PREFIX + key);
}

export async function cacheClearAll(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter((k) => k.startsWith(PREFIX));
  await AsyncStorage.multiRemove(cacheKeys);
}
