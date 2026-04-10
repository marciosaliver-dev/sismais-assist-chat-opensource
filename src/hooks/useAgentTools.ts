import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Tables, TablesInsert } from '@/integrations/supabase/types'

type Tool = Tables<'ai_agent_tools'>
type ToolInsert = TablesInsert<'ai_agent_tools'>

export function useAgentTools() {
  const queryClient = useQueryClient()

  const { data: tools, isLoading, error } = useQuery({
    queryKey: ['agent-tools'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agent_tools')
        .select('*')
        .order('name')
      
      if (error) throw error
      return data as Tool[]
    }
  })

  const createTool = useMutation({
    mutationFn: async (tool: ToolInsert) => {
      const { data, error } = await supabase
        .from('ai_agent_tools')
        .insert(tool)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-tools'] })
    }
  })

  const updateTool = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Tool> & { id: string }) => {
      const { data, error } = await supabase
        .from('ai_agent_tools')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-tools'] })
    }
  })

  const deleteTool = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_agent_tools')
        .update({ is_active: false })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-tools'] })
    }
  })

  const toggleTool = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('ai_agent_tools')
        .update({ is_active })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-tools'] })
    }
  })

  return { 
    tools: tools ?? [], 
    isLoading, 
    error,
    createTool,
    updateTool,
    deleteTool,
    toggleTool
  }
}

// Hook for knowledge quality metrics
export function useKnowledgeQuality() {
  const { data: qualityReport, isLoading } = useQuery({
    queryKey: ['knowledge-quality'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_knowledge_base')
        .select(`
          id,
          title,
          category,
          is_active,
          usage_count,
          updated_at,
          ai_knowledge_ratings (avg_rating, rating_count)
        `)
        .order('usage_count', { ascending: false })
        .limit(50)
      
      if (error) throw error
      return data
    }
  })

  return { qualityReport: qualityReport ?? [], isLoading }
}

// Hook for agent performance
export function useAgentPerformance() {
  const { data: performance, isLoading } = useQuery({
    queryKey: ['agent-performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select(`
          id,
          name,
          specialty,
          is_active,
          ai_api_logs (count, avg_latency: latency_ms.avg)
        `)
        .order('name')
      
      if (error) throw error
      return data
    }
  })

  return { performance: performance ?? [], isLoading }
}
