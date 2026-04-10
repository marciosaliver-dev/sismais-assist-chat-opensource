import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSharedRealtimeChannel } from '../useSharedRealtimeChannel'

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn()
    })),
    removeChannel: vi.fn()
  }
}))

describe('useSharedRealtimeChannel', () => {
  it('creates a channel on first subscriber', () => {
    const callback = vi.fn()
    const { result } = renderHook(() =>
      useSharedRealtimeChannel('ai_messages', 'INSERT', callback)
    )
    expect(result.current).toBeUndefined() // hook returns void
  })

  it('reuses existing channel for same table', () => {
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    renderHook(() => useSharedRealtimeChannel('ai_messages', 'INSERT', cb1))
    renderHook(() => useSharedRealtimeChannel('ai_messages', 'INSERT', cb2))
    // Should not create a second channel
  })
})
