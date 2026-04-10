import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { FlowExecution } from '@/types/flow'

export function useFlowExecutions(flowId?: string) {
  const { data: executions, isLoading } = useQuery({
    queryKey: ['flow-executions', flowId],
    enabled: !!flowId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flow_executions')
        .select('*')
        .eq('flow_id', flowId!)
        .order('started_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as unknown as FlowExecution[]
    }
  })

  return { executions, isLoading }
}
