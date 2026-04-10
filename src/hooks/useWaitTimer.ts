import { useState, useEffect } from 'react'

/**
 * Hook that returns elapsed seconds since a given timestamp, updated at intervalMs.
 */
export function useWaitTimer(since: string | null, intervalMs = 1000) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!since) { setElapsed(0); return }
    const origin = new Date(since).getTime()
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - origin) / 1000)))
    tick()
    const id = setInterval(tick, intervalMs)
    return () => clearInterval(id)
  }, [since, intervalMs])

  return elapsed
}

/**
 * Color class based on wait seconds (queue context).
 */
export function getWaitColor(seconds: number): string {
  if (seconds >= 1800) return 'text-[#DC2626]'
  if (seconds >= 900) return 'text-[#FFB800]'
  if (seconds >= 300) return 'text-[#92400E]'
  return 'text-[#16A34A]'
}

/**
 * Compact format: "2h 34m", "5m 12s", "34s"
 */
export function formatCompactTime(seconds: number): string {
  if (seconds < 0) seconds = 0
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/**
 * Full format: "00:05:12"
 */
export function formatHHMMSS(seconds: number): string {
  if (seconds < 0) seconds = 0
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}
