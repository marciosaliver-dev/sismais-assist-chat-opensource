import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface AgentMetric {
  agent_id: string
  agent_name: string
  specialty: string
  color: string
  is_active: boolean
  conversations_today: number
  conversations_week: number
  conversations_month: number
  resolution_rate: number
  avg_confidence: number
  avg_csat: number
  escalation_rate: number
  avg_response_time_ms: number
}

export function useAgentMetrics() {
  return useQuery({
    queryKey: ['agent-metrics'],
    queryFn: async () => {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data: agents } = await supabase
        .from('ai_agents')
        .select('id, name, specialty, color, is_active, total_conversations, success_rate, avg_confidence, avg_csat')
        .order('priority', { ascending: false })

      if (!agents) return []

      const { data: todayCounts } = await supabase
        .from('ai_conversations')
        .select('current_agent_id')
        .gte('started_at', todayStart)

      const { data: weekCounts } = await supabase
        .from('ai_conversations')
        .select('current_agent_id')
        .gte('started_at', weekStart)

      const { data: escalations } = await supabase
        .from('ai_conversations')
        .select('current_agent_id')
        .eq('handler_type', 'human')
        .gte('started_at', monthStart)

      const countByAgent = (data: any[] | null, agentId: string) =>
        (data || []).filter(c => c.current_agent_id === agentId).length

      return agents.map(agent => ({
        agent_id: agent.id,
        agent_name: agent.name,
        specialty: agent.specialty,
        color: agent.color || '#45E5E5',
        is_active: agent.is_active || false,
        conversations_today: countByAgent(todayCounts, agent.id),
        conversations_week: countByAgent(weekCounts, agent.id),
        conversations_month: agent.total_conversations || 0,
        resolution_rate: Number(agent.success_rate) || 0,
        avg_confidence: Number(agent.avg_confidence) || 0,
        avg_csat: Number(agent.avg_csat) || 0,
        escalation_rate: agent.total_conversations
          ? (countByAgent(escalations, agent.id) / agent.total_conversations) * 100
          : 0,
        avg_response_time_ms: 0,
      })) as AgentMetric[]
    },
    refetchInterval: 30_000,
  })
}
