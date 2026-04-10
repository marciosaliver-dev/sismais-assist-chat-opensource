import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useMemo, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Tables, TablesInsert } from '@/integrations/supabase/types'
import { useSharedRealtimeChannel } from './useSharedRealtimeChannel'

type Message = Tables<'ai_messages'>
type MessageInsert = TablesInsert<'ai_messages'>
type MessageWithAgent = Message & {
  ai_agents?: { name: string; color: string; specialty: string } | null;
  media_url?: string | null;
  media_type?: string | null;
  reaction_to_message_id?: string | null;
  reaction_emoji?: string | null;
  quoted_message_id?: string | null;
  quoted_content?: string | null;
  quoted_sender_name?: string | null;
  whatsapp_instance_id?: string | null;
}

const PAGE_SIZE = 50

export function useConversationMessages(conversationId: string) {
  const queryClient = useQueryClient()

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      let query = supabase
        .from('ai_messages')
        .select('*, ai_agents(name, color, specialty)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(PAGE_SIZE)

      if (pageParam) {
        query = query.gt('created_at', pageParam)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as MessageWithAgent[]
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined
      return lastPage[lastPage.length - 1]?.created_at ?? undefined
    },
    enabled: !!conversationId,
    refetchInterval: 5000,
  })

  // Flatten pages and reverse to chronological order
  const messages = useMemo(() => {
    if (!data?.pages) return []
    const all = data.pages.flatMap(p => p)
    all.sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime())
    return all
  }, [data])

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Realtime subscription with optimistic cache update for INSERT
  useSharedRealtimeChannel('ai_messages', 'INSERT', (payload) => {
    const newMsg = payload.new as Record<string, unknown>
    if (newMsg?.conversation_id !== conversationId) return
    queryClient.setQueryData(
      ['messages', conversationId],
      (old: InfiniteData<MessageWithAgent[]> | undefined) => {
        if (!old?.pages?.length) return old
        const msg = newMsg as unknown as MessageWithAgent
        // Check if message already exists (avoid duplicates)
        const exists = old.pages.some(page => page.some(m => m.id === msg.id))
        if (exists) return old
        // Append to last page (pages are in ascending chronological order)
        const newPages = [...old.pages]
        const lastIdx = newPages.length - 1
        newPages[lastIdx] = [...newPages[lastIdx], msg]
        return { ...old, pages: newPages }
      }
    )
  })

  // Realtime subscription with optimistic cache update for UPDATE
  useSharedRealtimeChannel('ai_messages', 'UPDATE', (payload) => {
    const updatedRaw = payload.new as Record<string, unknown>
    if (updatedRaw?.conversation_id !== conversationId) return
    const updated = updatedRaw as unknown as MessageWithAgent
    // Optimistic update: patch the specific message in cache instead of full refetch
    // This is critical for media_url updates from retry downloads — avoids re-rendering everything
    queryClient.setQueryData(
      ['messages', conversationId],
      (old: InfiniteData<MessageWithAgent[]> | undefined) => {
        if (!old?.pages?.length) return old
        let found = false
        const newPages = old.pages.map(page =>
          page.map(m => {
            if (m.id === updated.id) {
              found = true
              return { ...m, ...updated, ai_agents: m.ai_agents }
            }
            return m
          })
        )
        // If message was found and patched, return updated data without full refetch
        if (found) return { ...old, pages: newPages }
        // Otherwise invalidate to pick up any structural changes
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
        return old
      }
    )
  })

  const sendMessage = useMutation({
    mutationFn: async (message: MessageInsert) => {
      const { data, error } = await supabase
        .from('ai_messages')
        .insert(message)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onMutate: async (newMessage) => {
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] })
      const previous = queryClient.getQueryData(['messages', conversationId])

      const optimisticMsg: MessageWithAgent = {
        id: `optimistic-${Date.now()}`,
        conversation_id: conversationId,
        role: newMessage.role || 'assistant',
        content: newMessage.content || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ai_agents: null,
        media_url: newMessage.media_url as string | null ?? null,
        media_type: newMessage.media_type as string | null ?? null,
        delivery_status: 'sending',
      } as MessageWithAgent

      queryClient.setQueryData(
        ['messages', conversationId],
        (old: InfiniteData<MessageWithAgent[]> | undefined) => {
          if (!old?.pages?.length) return old
          const newPages = [...old.pages]
          const lastIdx = newPages.length - 1
          newPages[lastIdx] = [...newPages[lastIdx], optimisticMsg]
          return { ...old, pages: newPages }
        }
      )
      return { previous }
    },
    onError: (_err, _msg, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['messages', conversationId], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
    },
  })

  return {
    messages,
    isLoading,
    sendMessage,
    loadMore,
    hasMore: !!hasNextPage,
    isLoadingMore: isFetchingNextPage,
  }
}
