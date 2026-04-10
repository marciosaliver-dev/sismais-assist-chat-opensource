import { lazy, ComponentType } from 'react'

/**
 * Wrapper around React.lazy that retries failed dynamic imports.
 * When a deploy changes chunk hashes, cached pages may reference
 * old chunk URLs that no longer exist. This retries once with
 * cache-busting, then reloads the page as a last resort.
 */
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((err: unknown) => {
      // If we already tried reloading, don't loop forever
      const key = 'chunk_reload_ts'
      const lastReload = sessionStorage.getItem(key)
      const now = Date.now()

      if (lastReload && now - Number(lastReload) < 10_000) {
        // Already reloaded recently — surface the error
        throw err
      }

      sessionStorage.setItem(key, String(now))
      window.location.reload()

      // Return a never-resolving promise to avoid rendering while reloading
      return new Promise<{ default: T }>(() => {})
    }),
  )
}

/**
 * Like lazyRetry but for named exports:
 *   lazyRetryNamed(() => import('./Foo'), 'Foo')
 */
export function lazyRetryNamed<M, K extends keyof M>(
  factory: () => Promise<M>,
  name: K,
): React.LazyExoticComponent<M[K] & ComponentType<any>> {
  return lazyRetry(() =>
    factory().then((mod) => ({ default: mod[name] as any })),
  )
}
