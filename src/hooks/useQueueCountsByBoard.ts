import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function useQueueCountsByBoard(): Record<string, number> {
  const { data } = useQuery({
    queryKey: ['queue-counts-by-board'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('kanban_board_id')
        .eq('status', 'aguardando')
        .or('is_merged.is.null,is_merged.eq.false')

      if (error) throw error

      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        if (row.kanban_board_id) {
          counts[row.kanban_board_id] = (counts[row.kanban_board_id] ?? 0) + 1
        }
      }
      return counts
    },
    refetchInterval: 30_000,
  })

  return data ?? {}
}
