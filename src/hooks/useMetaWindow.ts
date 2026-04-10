import { useState, useEffect, useMemo } from 'react'

export interface WindowStatus {
  isOpen: boolean
  expiresAt: string | null
  remainingMs: number
  requiresTemplate: boolean
}

export function check24hWindow(lastCustomerMessageAt: string | null): WindowStatus {
  if (!lastCustomerMessageAt) {
    return { isOpen: false, expiresAt: null, remainingMs: 0, requiresTemplate: true }
  }
  const expiry = new Date(lastCustomerMessageAt).getTime() + 24 * 60 * 60 * 1000
  const now = Date.now()
  const remainingMs = Math.max(0, expiry - now)
  return {
    isOpen: remainingMs > 0,
    expiresAt: new Date(expiry).toISOString(),
    remainingMs,
    requiresTemplate: remainingMs <= 0,
  }
}

export function formatRemainingTime(ms: number): string {
  if (ms <= 0) return 'expirada'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h${minutes.toString().padStart(2, '0')}m`
  return `${minutes}m`
}

export function useMetaWindow(
  channelType: string | null | undefined,
  lastCustomerMessageAt: string | null | undefined,
): WindowStatus & { formattedRemaining: string } {
  const [tick, setTick] = useState(0)

  const isMetaChannel = channelType === 'meta_whatsapp'

  useEffect(() => {
    if (!isMetaChannel) return
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [isMetaChannel])

  const status = useMemo(
    () => check24hWindow(lastCustomerMessageAt ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lastCustomerMessageAt, tick],
  )

  const formattedRemaining = useMemo(
    () => formatRemainingTime(status.remainingMs),
    [status.remainingMs],
  )

  return { ...status, formattedRemaining }
}
