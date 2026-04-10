import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function useAIModels() {
  const { data: models, isLoading } = useQuery({
    queryKey: ['ai-models'],
    queryFn: async () => {
      const { data: agents } = await supabase
        .from('ai_agents')
        .select('name, model, is_active')
        .eq('is_active', true)

      const modelMap = new Map<string, string[]>()
      agents?.forEach(a => {
        if (a.model) {
          const list = modelMap.get(a.model) || []
          list.push(a.name)
          modelMap.set(a.model, list)
        }
      })

      return Array.from(modelMap.entries()).map(([model_id, agent_names]) => ({
        model_id,
        display_name: model_id.split('/').pop() || model_id,
        provider: model_id.split('/')[0] || 'unknown',
        agents_using: agent_names,
      }))
    },
  })

  const testModel = useMutation({
    mutationFn: async (modelId: string) => {
      const start = Date.now()
      const { data, error } = await supabase.functions.invoke('agent-executor', {
        body: {
          mode: 'playground',
          agent_id: null,
          message_content: 'Responda apenas: "OK"',
          conversation_history: [],
          extra_system_prompt: 'Responda apenas "OK".',
        },
      })
      const latency = Date.now() - start
      if (error) throw error
      return { latency, model: modelId }
    },
  })

  return { models, isLoading, testModel }
}
