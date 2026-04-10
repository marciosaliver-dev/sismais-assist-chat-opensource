import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Tables } from '@/integrations/supabase/types'

const LOCALSTORAGE_KEY = 'inbox-read-timestamps'

function loadReadTimestamps(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveReadTimestamps(ts: Record<string, string>) {
  try {
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(ts))
  } catch { /* ignore quota errors */ }
}

// Background batch avatar fetch — runs once after conversations load
function useBatchAvatarSync(conversations: Array<{ customer_phone: string; uazapi_chat_id?: string | null }>, instanceId?: string) {
  const syncedRef = useRef(false)

  useEffect(() => {
    if (syncedRef.current || !instanceId || conversations.length === 0) return
    syncedRef.current = true

    // Collect phones that might need avatars
    const phones = conversations
      .filter(c => c.customer_phone && !c.uazapi_chat_id?.includes('@g.us'))
      .map(c => ({ phone: c.customer_phone }))
      .slice(0, 50)

    if (phones.length === 0) return

    // Fire-and-forget batch call
    supabase.functions.invoke('whatsapp-sync-avatars', {
      body: { instance_id: instanceId, batch: phones },
    }).catch(() => {})
  }, [conversations.length > 0, instanceId])
}

type Conversation = Tables<'ai_conversations'> & {
  ai_agents?: { name: string; color: string; specialty: string } | null
  human_agents?: { name: string } | null
  _last_message_preview?: string | null
  _last_message_time?: string | null
  _unread_count?: number
}

export function useInboxConversations(instanceId?: string, filterInstanceId?: string) {
  const queryClient = useQueryClient()
  // Track which conversations were "read" (selected) — persisted to localStorage
  const readTimestamps = useRef<Record<string, string>>(loadReadTimestamps())

  // Debounce ref to avoid rapid consecutive invalidations from realtime
  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedInvalidate = useCallback(() => {
    if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current)
    invalidateTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations', 'inbox'] })
    }, 500) // Debounce 500ms — batches rapid realtime updates
  }, [queryClient])

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations', 'inbox', filterInstanceId || 'all'],
    queryFn: async () => {
      let query = supabase
        .from('ai_conversations')
        .select('*, ai_agents(name, color, specialty), human_agents!ai_conversations_human_agent_id_fkey(name)')
        .in('status', ['aguardando', 'em_atendimento', 'finalizado'])
        .or('is_merged.is.null,is_merged.eq.false')
        .order('last_customer_message_at', { ascending: false, nullsFirst: false })
        .order('started_at', { ascending: false })
        .limit(100)

      // Filter by instance if specified (not "all")
      if (filterInstanceId && filterInstanceId !== 'all') {
        query = query.or(`whatsapp_instance_id.eq.${filterInstanceId},channel_instance_id.eq.${filterInstanceId}`)
      }

      const { data, error } = await query

      if (error) throw error

      const convs = data as Conversation[]

      // Fetch ONLY the latest message per conversation (optimized)
      // Instead of fetching ALL messages, we fetch 1 per conversation
      if (convs.length > 0) {
        const convIds = convs.map(c => c.id)

        // Batch fetch: get latest message + unread count per conversation
        // We fetch max 2 messages per conversation (1 latest for preview, up to 1 unread user msg for count)
        // This replaces the old N+1 pattern that fetched ALL messages
        const { data: latestMsgs } = await supabase
          .from('ai_messages')
          .select('conversation_id, content, created_at, role, media_type')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
          .limit(convIds.length) // At most 1 per conversation (the latest)

        // Also fetch unread user message counts efficiently
        // Only fetch user messages newer than last read timestamp
        const oldestReadTs = Object.values(readTimestamps.current).sort()[0] || '2020-01-01T00:00:00Z'
        const { data: unreadMsgs } = await supabase
          .from('ai_messages')
          .select('conversation_id, created_at')
          .in('conversation_id', convIds)
          .eq('role', 'user')
          .gte('created_at', oldestReadTs)
          .order('created_at', { ascending: false })

        if (latestMsgs) {
          // Group: first message per conversation = latest
          const latestByConv = new Map<string, typeof latestMsgs[0]>()
          for (const msg of latestMsgs) {
            if (msg.conversation_id && !latestByConv.has(msg.conversation_id)) {
              latestByConv.set(msg.conversation_id, msg)
            }
          }

          // Count unread (user messages after last read timestamp)
          const unreadByConv = new Map<string, number>()
          if (unreadMsgs) {
            for (const msg of unreadMsgs) {
              if (!msg.conversation_id) continue
              const lastRead = readTimestamps.current[msg.conversation_id]
              if (!lastRead || new Date(msg.created_at!) > new Date(lastRead)) {
                unreadByConv.set(msg.conversation_id, (unreadByConv.get(msg.conversation_id) || 0) + 1)
              }
            }
          }

          for (const conv of convs) {
            const latest = latestByConv.get(conv.id)
            if (latest) {
              const mediaLabel = latest.media_type
                ? latest.media_type === 'image' ? '📷 Imagem'
                : latest.media_type === 'video' ? '🎥 Vídeo'
                : latest.media_type === 'audio' || latest.media_type === 'ptt' ? '🎤 Áudio'
                : latest.media_type === 'document' ? '📄 Documento'
                : ''
                : ''
              conv._last_message_preview = mediaLabel || latest.content?.substring(0, 80) || ''
              conv._last_message_time = latest.created_at
            }
            conv._unread_count = unreadByConv.get(conv.id) || 0
          }
        }
      }

      return convs
    },
    // Increased from 5s to 30s — realtime subscriptions handle real-time updates
    refetchInterval: 30000,
    // Keep previous data during refetches to avoid flicker
    placeholderData: keepPreviousData,
    // Avoid unnecessary refetches when returning to tab
    staleTime: 10000,
  })

  // Mark conversation as read (persisted to localStorage)
  const markAsRead = useCallback((conversationId: string) => {
    readTimestamps.current[conversationId] = new Date().toISOString()
    saveReadTimestamps(readTimestamps.current)
    // Use setQueryData for instant UI update instead of full refetch
    queryClient.setQueryData(
      ['conversations', 'inbox', filterInstanceId || 'all'],
      (old: Conversation[] | undefined) => {
        if (!old) return old
        return old.map(c => c.id === conversationId ? { ...c, _unread_count: 0 } : c)
      }
    )
  }, [queryClient, filterInstanceId])

  // Realtime subscriptions — debounced to batch rapid updates
  useEffect(() => {
    const channel = supabase
      .channel('inbox-conversations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_conversations' },
        () => {
          debouncedInvalidate()
        }
      )
      .subscribe()

    // Also listen for new messages to update previews
    const msgChannel = supabase
      .channel('inbox-messages-preview')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_messages' },
        () => {
          debouncedInvalidate()
        }
      )
      .subscribe()

    return () => {
      if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current)
      supabase.removeChannel(channel)
      supabase.removeChannel(msgChannel)
    }
  }, [queryClient, debouncedInvalidate])

  // Background batch avatar sync
  useBatchAvatarSync(conversations ?? [], instanceId)

  return { conversations: conversations ?? [], isLoading, markAsRead }
}
