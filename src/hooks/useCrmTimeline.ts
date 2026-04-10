import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { TimelineEvent } from './useCustomer360'

interface TimelineFilters {
  eventTypes?: string[]
  channels?: string[]
  limit?: number
}

export function useCrmTimeline(
  clientId: string | undefined,
  filters?: TimelineFilters,
) {
  const limit = filters?.limit || 50

  return useQuery<TimelineEvent[]>({
    queryKey: ['crm-timeline', clientId, filters],
    queryFn: async () => {
      let query = supabase
        .from('crm_timeline')
        .select('id, event_type, channel, title, description, metadata, actor_type, actor_name, occurred_at, created_at, conversation_id, contract_id')
        .order('occurred_at', { ascending: false })
        .limit(limit)

      if (clientId) {
        query = query.eq('client_id', clientId)
      }

      if (filters?.eventTypes && filters.eventTypes.length > 0) {
        query = query.in('event_type', filters.eventTypes)
      }

      if (filters?.channels && filters.channels.length > 0) {
        query = query.in('channel', filters.channels)
      }

      const { data, error } = await query
      if (error) throw error
      return (data || []) as TimelineEvent[]
    },
    enabled: true,
    staleTime: 2 * 60 * 1000,
  })
}

export function useRecentTimeline(limit = 20) {
  return useCrmTimeline(undefined, { limit })
}
