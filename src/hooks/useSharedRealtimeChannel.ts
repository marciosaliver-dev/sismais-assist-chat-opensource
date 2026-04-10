import { useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type EventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*'
type Callback = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void

interface ChannelState {
  channel: RealtimeChannel
  subscribers: Set<Callback>
}

// Module-level shared channels (survives re-renders, one per table+event)
const channels = new Map<string, ChannelState>()

/**
 * Subscribe to Realtime changes on a table using a shared channel.
 * Multiple components subscribing to the same table reuse one channel.
 * Client-side filtering is the caller's responsibility.
 */
export function useSharedRealtimeChannel(
  table: string,
  event: EventType,
  callback: Callback
): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const key = `${table}:${event}`
    const wrappedCallback: Callback = (payload) => callbackRef.current(payload)

    let state = channels.get(key)

    if (!state) {
      const channel = supabase
        .channel(`shared:${key}`)
        .on(
          'postgres_changes',
          { event, schema: 'public', table },
          (payload) => {
            const s = channels.get(key)
            if (s) {
              for (const cb of s.subscribers) {
                cb(payload)
              }
            }
          }
        )
        .subscribe()

      state = { channel, subscribers: new Set() }
      channels.set(key, state)
    }

    state.subscribers.add(wrappedCallback)

    return () => {
      const s = channels.get(key)
      if (s) {
        s.subscribers.delete(wrappedCallback)
        if (s.subscribers.size === 0) {
          supabase.removeChannel(s.channel)
          channels.delete(key)
        }
      }
    }
  }, [table, event])
}
