// Admin Portal SWR Caching Engine for 0ms Instant Rendering with Real-Time Background Synchronization

interface AdminCacheEntry<T> {
  data: T;
  timestamp: number;
}

const adminMemoryStore: Record<string, AdminCacheEntry<any>> = {};
const adminSubscribers: Map<string, Set<(data: any) => void>> = new Map();

// Cross-context Broadcast Channel for instant live synchronization across tabs and portals
let adminBroadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    adminBroadcastChannel = new BroadcastChannel('examizo_live_sync_channel');
    adminBroadcastChannel.onmessage = (event) => {
      const { type, key, data } = event.data || {};
      if (type === 'ADMIN_SWR_UPDATE' && key && data !== undefined) {
        setAdminSwrCache(key, data, false);
      } else if (type === 'TRIGGER_PREFETCH') {
        prefetchAllAdminData();
      }
    };
  } catch (_) {}
}

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
 * Updates cache in memory and persistent storage, notifying local subscribers and broadcasting.
 */
export function setAdminSwrCache<T = any>(key: string, data: T, broadcast = true): void {
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

  // Notify local subscribers
  const keySubs = adminSubscribers.get(key);
  if (keySubs) {
    keySubs.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[AdminSWR] Error notifying listener for ${key}:`, err);
      }
    });
  }

  // Broadcast to other tabs/windows
  if (broadcast && adminBroadcastChannel) {
    try {
      adminBroadcastChannel.postMessage({ type: 'ADMIN_SWR_UPDATE', key, data });
    } catch (_) {}
  }
}

/**
 * Subscribes to real-time SWR cache updates for a given key.
 * Returns an unsubscribe function.
 */
export function subscribeAdminSwrCache<T = any>(key: string, callback: (data: T) => void): () => void {
  if (!adminSubscribers.has(key)) {
    adminSubscribers.set(key, new Set());
  }
  const subs = adminSubscribers.get(key)!;
  subs.add(callback);

  return () => {
    subs.delete(callback);
    if (subs.size === 0) {
      adminSubscribers.delete(key);
    }
  };
}

/**
 * Emits a global live-sync broadcast across all tabs and both portals whenever an admin mutation occurs.
 */
export function broadcastAdminChange(resourceType: string = 'general'): void {
  if (typeof window === 'undefined') return;

  // 1. Post message to cross-context broadcast channel
  if (adminBroadcastChannel) {
    try {
      adminBroadcastChannel.postMessage({ type: 'TRIGGER_PREFETCH', resourceType });
    } catch (_) {}
  }

  // 2. Dispatch custom event locally
  try {
    window.dispatchEvent(new CustomEvent('examizo_admin_mutation', { detail: { resourceType } }));
  } catch (_) {}

  // 3. Immediately trigger prefetch locally
  prefetchAllAdminData(true);
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

let isAdminPrefetching = false;
let lastAdminPrefetchTime = 0;

/**
 * Concurrently prefetches and caches ALL admin portal module data in the background.
 * Loads Dashboard, Questions, Mock Tests, Courses, Users, Gallery, Resources, Performance, and Audit Logs simultaneously.
 */
export async function prefetchAllAdminData(force = false): Promise<void> {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  if (isAdminPrefetching || (!force && now - lastAdminPrefetchTime < 2500)) {
    return;
  }

  isAdminPrefetching = true;
  lastAdminPrefetchTime = now;

  try {
    await Promise.allSettled([
      // 1. Dashboard metrics & hourly activity
      fetch('/api/dashboard', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && (data.metrics || data.hourlyData || data.auditLogs)) {
            const cacheObj = {
              metrics: data.metrics,
              hourlyData: data.hourlyData,
              auditLogs: data.auditLogs,
            };
            setAdminSwrCache('admin_dashboard_cache', cacheObj);
          }
        })
        .catch(() => {}),

      // 2. Questions & Courses
      Promise.all([
        fetch('/api/questions', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/courses', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]).then(([qData, cData]) => {
        const coursesList = cData && Array.isArray(cData.courses) ? cData.courses : [];
        if (coursesList.length > 0) {
          setAdminSwrCache('admin_courses_cache', coursesList);
        }
        if (qData && Array.isArray(qData.questions)) {
          setAdminSwrCache('questions_cache', {
            courses: coursesList.length > 0 ? coursesList : (qData.courses || []),
            questions: qData.questions || [],
          });
        }
      }).catch(() => {}),

      // 3. Mock Tests
      fetch('/api/mock-tests', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && (data.tests || data.courses)) {
            setAdminSwrCache('admin_mock_tests_cache', data);
          }
        })
        .catch(() => {}),

      // 4. Users & Admins
      fetch('/api/users', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && (data.users || data.admins)) {
            setAdminSwrCache('admin_users_cache', data);
          }
        })
        .catch(() => {}),

      // 5. Gallery
      fetch('/api/gallery', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.success && Array.isArray(data.gallery)) {
            setAdminSwrCache('admin_gallery_cache', data.gallery);
          }
        })
        .catch(() => {}),

      // 6. Resources
      fetch('/api/resources', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && (data.resources || data.courses)) {
            setAdminSwrCache('admin_resources_cache', data);
          }
        })
        .catch(() => {}),

      // 7. Student Performance
      fetch('/api/student-performance', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && (data.users || data.courses)) {
            setAdminSwrCache('admin_performance_cache', data);
          }
        })
        .catch(() => {}),

      // 8. Audit Logs
      fetch('/api/audit-logs', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.logs)) {
            setAdminSwrCache('admin_audit_logs_cache', data.logs);
          }
        })
        .catch(() => {}),
    ]);
  } finally {
    isAdminPrefetching = false;
  }
}
