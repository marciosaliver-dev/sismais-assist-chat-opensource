import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { BusinessHourEntry } from '@/utils/calculateBusinessMinutes'

export function useBusinessHours(boardId: string | null | undefined) {
  return useQuery({
    queryKey: ['business-hours', boardId],
    queryFn: async () => {
      if (!boardId) return []
      const { data, error } = await (supabase as any)
        .from('business_hours')
        .select('day_of_week, start_time, end_time, is_active')
        .eq('board_id', boardId)
        .order('day_of_week')
      if (error) {
        console.error('Failed to fetch business hours:', error)
        return []
      }
      return (data || []) as BusinessHourEntry[]
    },
    enabled: !!boardId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })
}
