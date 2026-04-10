import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function useAutomationLogs(automationId?: string) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['automation-logs', automationId],
    queryFn: async () => {
      let query = supabase
        .from('ai_automation_logs')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(50)

      if (automationId) {
        query = query.eq('automation_id', automationId)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
    refetchInterval: 10000,
  })

  return { logs, isLoading }
}
