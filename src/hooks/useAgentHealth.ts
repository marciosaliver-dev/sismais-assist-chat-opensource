import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

interface AgentHealth {
  totalMessages: number
  respondedMessages: number
  responseRate: number
  escalations: number
  unresponded: number
  deadLetterCount: number
}

export function useAgentHealth(hours = 24) {
  return useQuery({
    queryKey: ['agent-health', hours],
    queryFn: async (): Promise<AgentHealth> => {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

      const [
        { count: totalMessages },
        { count: respondedMessages },
        { count: deadLetterCount },
        { count: escalations },
      ] = await Promise.all([
        supabase.from('ai_messages').select('*', { count: 'exact', head: true }).eq('role', 'user').gte('created_at', since),
        supabase.from('ai_messages').select('*', { count: 'exact', head: true }).eq('role', 'assistant').gte('created_at', since),
        supabase.from('dead_letter_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('ai_conversations').select('*', { count: 'exact', head: true }).eq('handler_type', 'human').gte('updated_at', since),
      ])

      const total = totalMessages || 0
      const responded = respondedMessages || 0

      return {
        totalMessages: total,
        respondedMessages: responded,
        responseRate: total > 0 ? (responded / total) * 100 : 100,
        escalations: escalations || 0,
        unresponded: Math.max(0, total - responded),
        deadLetterCount: deadLetterCount || 0,
      }
    },
    refetchInterval: 60_000,
  })
}
