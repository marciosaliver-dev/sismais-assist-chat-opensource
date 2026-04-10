import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import type { FlowVersion } from '@/types/flow'

export function useFlowVersions(flowId?: string) {
  const queryClient = useQueryClient()

  const { data: versions, isLoading } = useQuery({
    queryKey: ['flow-versions', flowId],
    enabled: !!flowId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flow_versions')
        .select('*')
        .eq('flow_id', flowId!)
        .order('version', { ascending: false })
      if (error) throw error
      return data as unknown as FlowVersion[]
    }
  })

  const createVersion = useMutation({
    mutationFn: async (version: Omit<FlowVersion, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('flow_versions')
        .insert({
          flow_id: version.flow_id,
          version: version.version,
          nodes: version.nodes as any,
          edges: version.edges as any,
          variables: (version.variables || {}) as any,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flow-versions', flowId] })
      toast.success('Versão salva!')
    }
  })

  return { versions, isLoading, createVersion }
}
