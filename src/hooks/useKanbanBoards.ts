import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface KanbanBoard {
  id: string
  name: string
  slug: string | null
  board_type: string
  icon: string | null
  color: string
  is_default: boolean
  active: boolean
  sort_order: number
  queue_alert_threshold_minutes: number | null
}

export function useKanbanBoards() {
  return useQuery({
    queryKey: ['kanban-boards-active'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('kanban_boards')
        .select('id, name, slug, board_type, icon, color, is_default, active, sort_order, queue_alert_threshold_minutes')
        .eq('active', true)
        .order('is_default', { ascending: false })
        .order('sort_order')
      if (error) throw error
      return (data || []) as KanbanBoard[]
    },
  })
}
