import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import type { HumanAgent } from '@/types/flow'

export function useHumanAgents() {
  const queryClient = useQueryClient()

  const { data: agents, isLoading } = useQuery({
    queryKey: ['human-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('human_agents')
        .select('*')
        .neq('is_active', false)
        .order('name')
      if (error) throw error
      return data as unknown as HumanAgent[]
    },
    placeholderData: keepPreviousData,
  })

  const createAgent = useMutation({
    mutationFn: async (agent: Partial<HumanAgent>) => {
      const { data, error } = await supabase
        .from('human_agents')
        .insert({
          name: agent.name || '',
          email: agent.email || null,
          specialties: agent.specialties || [],
          max_concurrent_conversations: agent.max_concurrent_conversations || 5,
          user_id: agent.user_id || null,
          is_active: true,
        } as any)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['human-agents'] })
      toast.success('Agente criado!')
    }
  })

  const updateAgent = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<HumanAgent> }) => {
      const { error } = await supabase.from('human_agents').update(updates as any).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['human-agents'] })
  })

  return { agents, isLoading, createAgent, updateAgent }
}
