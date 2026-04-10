import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function useDiagnosticCount() {
  const { data: count = 0 } = useQuery({
    queryKey: ['diagnostic-count'],
    queryFn: async () => {
      let issues = 0

      const [agentsRes, instancesRes] = await Promise.all([
        supabase.from('ai_agents').select('id, description, system_prompt, rag_enabled, rag_similarity_threshold, confidence_threshold').eq('is_active', true),
        (supabase as any).from('uazapi_instances_public').select('status').eq('is_active', true),
      ])

      const agents = agentsRes.data ?? []
      const instances = instancesRes.data ?? []

      // Agents without description
      if (agents.some((a) => !a.description || a.description.trim() === '')) issues++
      // Agents with empty system_prompt
      if (agents.some((a) => !a.system_prompt || a.system_prompt.trim() === '')) issues++
      // RAG with very high threshold
      if (agents.some((a) => a.rag_enabled && (a.rag_similarity_threshold ?? 0) > 0.9)) issues++
      // Disconnected WhatsApp
      if (instances.some((i) => i.status !== 'connected' && i.status !== 'open')) issues++

      return issues
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  return { count }
}
