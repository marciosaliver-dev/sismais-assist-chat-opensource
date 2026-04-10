import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import type { FlowAutomation } from '@/types/flow'

export function useFlowAutomations() {
  const queryClient = useQueryClient()

  const { data: flows, isLoading } = useQuery({
    queryKey: ['flow-automations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flow_automations')
        .select('*')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as unknown as FlowAutomation[]
    },
    placeholderData: keepPreviousData,
  })

  const createFlow = useMutation({
    mutationFn: async (flow: Partial<FlowAutomation>) => {
      const { data, error } = await supabase
        .from('flow_automations')
        .insert({
          name: flow.name || 'Novo Fluxo',
          trigger_type: flow.trigger_type || 'message_received',
          nodes: (flow.nodes || []) as any,
          edges: (flow.edges || []) as any,
          variables: (flow.variables || {}) as any,
          trigger_config: (flow.trigger_config || {}) as any,
          description: flow.description || null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flow-automations'] })
      toast.success('Fluxo criado!')
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`)
  })

  const updateFlow = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FlowAutomation> }) => {
      const payload: Record<string, any> = {}
      if (updates.name !== undefined) payload.name = updates.name
      if (updates.description !== undefined) payload.description = updates.description
      if (updates.nodes !== undefined) payload.nodes = updates.nodes as any
      if (updates.edges !== undefined) payload.edges = updates.edges as any
      if (updates.variables !== undefined) payload.variables = updates.variables as any
      if (updates.trigger_type !== undefined) payload.trigger_type = updates.trigger_type
      if (updates.trigger_config !== undefined) payload.trigger_config = updates.trigger_config as any
      if (updates.is_active !== undefined) payload.is_active = updates.is_active
      if (updates.is_published !== undefined) payload.is_published = updates.is_published
      if (updates.whatsapp_instances !== undefined) payload.whatsapp_instances = updates.whatsapp_instances

      const { data, error } = await supabase
        .from('flow_automations')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flow-automations'] })
      toast.success('Fluxo salvo!')
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`)
  })

  const deleteFlow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('flow_automations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flow-automations'] })
      toast.success('Fluxo excluído!')
    }
  })

  const toggleFlow = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('flow_automations').update({ is_active: active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flow-automations'] })
  })

  return { flows, isLoading, createFlow, updateFlow, deleteFlow, toggleFlow }
}
