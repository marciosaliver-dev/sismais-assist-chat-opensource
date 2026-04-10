import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface SLAConfig {
  first_response_target_minutes: number
  resolution_target_minutes: number
}

export function useSLAConfig() {
  return useQuery({
    queryKey: ['ticket-sla-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_sla_config' as any)
        .select('priority, first_response_target_minutes, resolution_target_minutes')
        .eq('active', true)

      if (error) throw error

      const map = new Map<string, SLAConfig>()
      for (const row of (data || []) as any[]) {
        map.set(row.priority, {
          first_response_target_minutes: row.first_response_target_minutes,
          resolution_target_minutes: row.resolution_target_minutes,
        })
      }
      return map
    },
    staleTime: 5 * 60 * 1000,
  })
}
