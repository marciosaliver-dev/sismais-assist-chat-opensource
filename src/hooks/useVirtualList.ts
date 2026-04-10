import { useState, useCallback, useMemo, useRef } from 'react'
import { useThrottledCallback } from './useThrottle'

interface VirtualListResult<T> {
  visibleItems: { item: T; index: number }[]
  totalHeight: number
  offsetTop: number
  onScroll: (e: React.UIEvent<HTMLElement>) => void
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function useVirtualList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan = 10
): VirtualListResult<T> {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleScroll = useThrottledCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop((e.target as HTMLElement).scrollTop)
  })

  const { visibleItems, offsetTop, totalHeight } = useMemo(() => {
    const total = items.length * itemHeight
    if (containerHeight <= 0 || items.length === 0) {
      return { visibleItems: [] as { item: T; index: number }[], offsetTop: 0, totalHeight: total }
    }

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )

    const visible: { item: T; index: number }[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      visible.push({ item: items[i], index: i })
    }

    return {
      visibleItems: visible,
      offsetTop: startIndex * itemHeight,
      totalHeight: total,
    }
  }, [items, itemHeight, containerHeight, scrollTop, overscan])

  return { visibleItems, totalHeight, offsetTop, onScroll: handleScroll, containerRef }
}
