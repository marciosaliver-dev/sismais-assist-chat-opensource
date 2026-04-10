import { useCallback, useRef } from 'react'

export function useThrottledCallback<T extends (...args: unknown[]) => void>(
  callback: T,
): T {
  const rafRef = useRef<number | null>(null)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const throttled = useCallback((...args: unknown[]) => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      callbackRef.current(...args)
      rafRef.current = null
    })
  }, []) as unknown as T

  return throttled
}
