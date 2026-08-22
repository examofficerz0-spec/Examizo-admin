// Admin Portal SWR Caching Engine for 0ms Instant Rendering with Real-Time Background Synchronization

interface AdminCacheEntry<T> {
  data: T;
  timestamp: number;
}

const adminMemoryStore: Record<string, AdminCacheEntry<any>> = {};

/**
 * Synchronously retrieves cached admin data from memory or localStorage for instant 0ms render.
 */
export function getAdminSwrCache<T = any>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  try {
    // 1. In-memory store (fastest)
    const mem = adminMemoryStore[key];
    if (mem && mem.data !== undefined) {
      return mem.data;
    }

    // 2. Local storage persistent cache fallback
    const raw = localStorage.getItem(`__ADMIN_SWR_${key}__`);
    if (raw) {
      const parsed: AdminCacheEntry<T> = JSON.parse(raw);
      if (parsed && parsed.data !== undefined) {
        adminMemoryStore[key] = parsed;
        return parsed.data;
      }
    }
  } catch (e) {
    // ignore parse or storage errors
  }

  return null;
}

/**
 * Updates cache in memory and persistent storage.
 */
export function setAdminSwrCache<T = any>(key: string, data: T): void {
  if (typeof window === 'undefined') return;

  const entry: AdminCacheEntry<T> = {
    data,
    timestamp: Date.now(),
  };

  adminMemoryStore[key] = entry;

  try {
    localStorage.setItem(`__ADMIN_SWR_${key}__`, JSON.stringify(entry));
  } catch (e) {
    // if quota exceeded, silently continue
  }
}

/**
 * Clears cache for a key or all keys.
 */
export function clearAdminSwrCache(key?: string): void {
  if (typeof window === 'undefined') return;

  if (key) {
    delete adminMemoryStore[key];
    try {
      localStorage.removeItem(`__ADMIN_SWR_${key}__`);
    } catch (_) {}
    return;
  }

  for (const k of Object.keys(adminMemoryStore)) {
    delete adminMemoryStore[k];
  }

  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey && storageKey.startsWith('__ADMIN_SWR_')) {
        toRemove.push(storageKey);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch (_) {}
}
