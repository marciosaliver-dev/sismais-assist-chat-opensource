import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types'

type Agent = Tables<'ai_agents'>
type AgentInsert = TablesInsert<'ai_agents'>
type AgentUpdate = TablesUpdate<'ai_agents'>

export function useAgents() {
  const queryClient = useQueryClient()

  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .order('priority', { ascending: false })
      
      if (error) throw error
      return data as Agent[]
    },
    placeholderData: keepPreviousData,
  })

  const createAgent = useMutation({
    mutationFn: async (agent: AgentInsert) => {
      const { data, error } = await supabase
        .from('ai_agents')
        .insert(agent)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    }
  })

  const updateAgent = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: AgentUpdate }) => {
      const { data, error } = await supabase
        .from('ai_agents')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    }
  })

  const deleteAgent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_agents')
        .delete()
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    }
  })

  return {
    agents: agents ?? [],
    isLoading,
    createAgent,
    updateAgent,
    deleteAgent
  }
}
