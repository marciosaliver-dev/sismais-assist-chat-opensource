// In-memory cache with TTL for Deno Edge Functions.
// Cache survives between warm invocations, dies on cold start.
// No external dependencies (no Redis needed).

interface CacheEntry<T> {
  data: T
  expires: number
}

const store = new Map<string, CacheEntry<unknown>>()

/**
 * Get cached data or fetch it. Thread-safe for single-isolate Deno runtime.
 *
 * @param key - Unique cache key (e.g. 'active_agents')
 * @param ttlMs - Time-to-live in milliseconds (e.g. 300_000 for 5 min)
 * @param fetcher - Async function that returns fresh data
 * @returns Cached or freshly fetched data
 */
export async function cachedQuery<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = store.get(key)
  if (cached && Date.now() < cached.expires) {
    return cached.data as T
  }

  const data = await fetcher()
  store.set(key, { data, expires: Date.now() + ttlMs })
  return data
}

/**
 * Invalidate a specific cache key. Use when you know data changed.
 */
export function invalidateCache(key: string): void {
  store.delete(key)
}

/**
 * Clear all cached data. Use sparingly.
 */
export function clearCache(): void {
  store.clear()
}
