import { useEffect, useState, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export function usePendingMessages() {
  const queryClient = useQueryClient()
  const [totalPendingCount, setTotalPendingCount] = useState(0)
  const audioEnabledRef = useRef(true)

  // Fetch initial pending count from conversations with unread user messages
  useEffect(() => {
    const fetchPendingCount = async () => {
      const { count, error } = await supabase
        .from('ai_messages')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'user')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .is('deleted_at', null)

      if (!error && count !== null) {
        // Get read timestamps from localStorage
        const readTs = getReadTimestamps()
        // We approximate: count messages newer than oldest read timestamp
        // The exact count will come from useInboxConversations
        setTotalPendingCount(prev => prev) // keep existing until realtime updates
      }
    }
    fetchPendingCount()
  }, [])

  const playSound = useCallback(() => {
    if (!audioEnabledRef.current) return
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 800
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.5)
    } catch {
      // Ignore audio errors (e.g. user hasn't interacted with page yet)
    }
  }, [])

  // Subscribe to new customer messages via realtime
  useEffect(() => {
    const channel = supabase
      .channel('pending-messages-global')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_messages',
        },
        (payload) => {
          const msg = payload.new as { role?: string; content?: string; customer_name?: string; conversation_id?: string }
          if (msg.role !== 'user') return

          // Increment pending count
          setTotalPendingCount(prev => prev + 1)

          // Play notification sound
          playSound()

          // Show toast with message preview
          const preview = msg.content?.substring(0, 80) || 'Nova mensagem'
          toast.info('Nova mensagem de cliente', {
            description: preview,
            duration: 4000,
          })

          // Invalidate inbox conversations to update previews
          queryClient.invalidateQueries({ queryKey: ['conversations', 'inbox'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, playSound])

  // Sync pending count from inbox conversations data
  const syncFromInbox = useCallback((unreadTotal: number) => {
    setTotalPendingCount(unreadTotal)
  }, [])

  // Reset count for a specific conversation (when user opens it)
  const markConversationRead = useCallback(() => {
    setTotalPendingCount(prev => Math.max(0, prev - 1))
  }, [])

  return {
    totalPendingCount,
    syncFromInbox,
    markConversationRead,
  }
}

function getReadTimestamps(): Record<string, string> {
  try {
    const raw = localStorage.getItem('inbox-read-timestamps')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
