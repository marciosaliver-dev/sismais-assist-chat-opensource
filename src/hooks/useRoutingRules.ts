import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types'

type RoutingRule = Tables<'ai_routing_rules'>
type RoutingRuleInsert = TablesInsert<'ai_routing_rules'>
type RoutingRuleUpdate = TablesUpdate<'ai_routing_rules'>

export function useRoutingRules(agentId: string) {
  const queryClient = useQueryClient()

  const { data: rules, isLoading } = useQuery({
    queryKey: ['routing-rules', agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_routing_rules')
        .select('*')
        .eq('agent_id', agentId)
        .order('priority', { ascending: false })
      
      if (error) throw error
      return data as RoutingRule[]
    },
    enabled: !!agentId
  })

  const createRule = useMutation({
    mutationFn: async (rule: RoutingRuleInsert) => {
      const { data, error } = await supabase
        .from('ai_routing_rules')
        .insert(rule)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing-rules'] })
    }
  })

  const updateRule = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: RoutingRuleUpdate }) => {
      const { data, error } = await supabase
        .from('ai_routing_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing-rules'] })
    }
  })

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_routing_rules')
        .delete()
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing-rules'] })
    }
  })

  return { rules: rules ?? [], isLoading, createRule, updateRule, deleteRule }
}
