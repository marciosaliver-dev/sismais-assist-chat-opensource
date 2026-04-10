import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Tables } from '@/integrations/supabase/types'

type Conversation = Tables<'ai_conversations'>

export function useConversations(status?: string) {
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations', status],
    queryFn: async () => {
      let query = supabase
        .from('ai_conversations')
        .select('*')
        .neq('is_merged', true)
        .order('started_at', { ascending: false })

      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Conversation[]
    },
    placeholderData: keepPreviousData,
  })

  return {
    conversations: conversations ?? [],
    isLoading
  }
}
