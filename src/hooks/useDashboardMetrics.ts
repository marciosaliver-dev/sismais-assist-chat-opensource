import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { DashboardFilters } from '@/contexts/DashboardFilterContext'
import { applyDashboardFilters } from '@/lib/dashboard-query-helpers'

export function useDashboardMetrics(filters?: DashboardFilters) {
  // Fallback para "hoje" se não houver filtros
  const periodFrom = filters?.period.from.toISOString() || (() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString()
  })()
  const periodTo = filters?.period.to.toISOString() || new Date().toISOString()

  const filterKey = filters
    ? [filters.period.preset, filters.categoryIds, filters.moduleIds, filters.boardIds, filters.humanAgentIds, filters.aiAgentIds]
    : ['today']

  // Conversation stats for the selected period
  const { data: todayStats } = useQuery({
    queryKey: ['stats', 'dashboard', ...filterKey],
    queryFn: async () => {
      let query = supabase
        .from('ai_conversations')
        .select('*, human_started_at, resolved_at, first_human_response_seconds, agent_switches_count, priority, ai_messages_count, handler_type')

      if (filters) {
        query = applyDashboardFilters(query, filters)
      } else {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        query = query.gte('started_at', today.toISOString())
          .or('is_discarded.is.null,is_discarded.eq.false')
      }

      const { data: conversations, error } = await query
      if (error) throw error

      const total = conversations?.length || 0
      const finished = conversations?.filter(c => c.status === 'finalizado') || []
      const resolved = finished.length
      const aiResolved = conversations?.filter(c => c.ai_resolved === true).length || 0
      const humanResolved = conversations?.filter(c => c.ai_resolved !== true && c.status === 'finalizado').length || 0

      const withCsat = conversations?.filter(c => c.csat_rating) || []
      const avgCsat = withCsat.length > 0
        ? withCsat.reduce((acc, c) => acc + (c.csat_rating || 0), 0) / withCsat.length
        : 0

      // TMA: abertura → conclusão
      const closedWithTime = conversations?.filter(c => c.status === 'finalizado' && c.resolved_at && c.started_at) || []
      const avgTimeSeconds = closedWithTime.length > 0
        ? Math.round(closedWithTime.reduce((acc, c) => {
            const start = new Date(c.started_at!).getTime()
            const end = new Date(c.resolved_at!).getTime()
            return acc + (end - start) / 1000
          }, 0) / closedWithTime.length)
        : 0

      // 1ª resposta humana
      const withFirstResponse = conversations?.filter(c => c.first_human_response_seconds && c.first_human_response_seconds > 0) || []
      const avgFirstResponseSeconds = withFirstResponse.length > 0
        ? Math.round(withFirstResponse.reduce((acc, c) => acc + (c.first_human_response_seconds || 0), 0) / withFirstResponse.length)
        : 0

      // FCR — First Contact Resolution (sem troca de agente)
      const fcrCount = finished.filter(c => (c.agent_switches_count || 0) <= 1).length
      const fcrRate = resolved > 0 ? Math.round((fcrCount / resolved) * 100) : 0

      // Escalação (IA → humano)
      const escalated = conversations?.filter(c =>
        c.handler_type === 'hybrid' || (c.human_started_at && c.ai_resolved === false)
      ).length || 0
      const escalationRate = total > 0 ? Math.round((escalated / total) * 100) : 0

      // Backlog — tickets não finalizados
      const backlog = conversations?.filter(c =>
        !['finalizado', 'cancelado'].includes(c.status || '')
      ).length || 0

      // Fila ativa
      const queueCount = conversations?.filter(c => c.status === 'aguardando').length || 0

      // Msgs/conversa
      const withMsgCount = conversations?.filter(c => c.ai_messages_count && c.ai_messages_count > 0) || []
      const avgMessagesPerConversation = withMsgCount.length > 0
        ? Math.round(withMsgCount.reduce((acc, c) => acc + (c.ai_messages_count || 0), 0) / withMsgCount.length * 10) / 10
        : 0

      return {
        total,
        resolved,
        aiResolved,
        humanResolved,
        aiResolvedPercent: total > 0 ? Math.round((aiResolved / total) * 100) : 0,
        avgCsat: Math.round(avgCsat * 10) / 10,
        avgTimeSeconds,
        avgFirstResponseSeconds,
        fcrRate,
        escalationRate,
        backlog,
        queueCount,
        avgMessagesPerConversation,
      }
    },
    refetchInterval: 10000,
  })

  // Cost metrics
  const { data: todayCosts } = useQuery({
    queryKey: ['costs', 'dashboard', periodFrom],
    queryFn: async () => {
      const { data: messages, error } = await supabase
        .from('ai_messages')
        .select('prompt_tokens, completion_tokens, total_tokens, cost_usd')
        .gte('created_at', periodFrom)
        .lte('created_at', periodTo)
        .not('cost_usd', 'is', null)

      if (error) throw error

      const totalTokens = messages?.reduce((acc, m) => acc + (m.total_tokens || 0), 0) || 0
      const totalCostUsd = messages?.reduce((acc, m) => acc + Number(m.cost_usd || 0), 0) || 0

      return {
        totalTokens,
        totalCostUsd,
        totalCostBrl: totalCostUsd * 5.8,
        messageCount: messages?.length || 0,
      }
    },
    refetchInterval: 30000,
  })

  // Weekly stats for chart
  const { data: weeklyStats } = useQuery({
    queryKey: ['stats', 'weekly', ...filterKey],
    queryFn: async () => {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
      sevenDaysAgo.setHours(0, 0, 0, 0)

      let query = supabase
        .from('ai_conversations')
        .select('started_at, resolved_by, ai_resolved')
        .gte('started_at', sevenDaysAgo.toISOString())
        .or('is_discarded.is.null,is_discarded.eq.false')

      if (filters) {
        if (filters.categoryIds.length > 0) query = query.in('ticket_category_id', filters.categoryIds)
        if (filters.moduleIds.length > 0) query = query.in('ticket_module_id', filters.moduleIds)
        if (filters.boardIds.length > 0) query = query.in('kanban_board_id', filters.boardIds)
        if (filters.humanAgentIds.length > 0) query = query.in('human_agent_id', filters.humanAgentIds)
        if (filters.aiAgentIds.length > 0) query = query.in('current_agent_id', filters.aiAgentIds)
      }

      const { data: conversations, error } = await query
      if (error) throw error

      const stats = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        date.setHours(0, 0, 0, 0)
        const nextDate = new Date(date)
        nextDate.setDate(nextDate.getDate() + 1)

        const dayConvs = conversations?.filter(c => {
          const d = new Date(c.started_at!)
          return d >= date && d < nextDate
        }) || []

        stats.push({
          date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          ai: dayConvs.filter(c => c.ai_resolved === true).length,
          human: dayConvs.filter(c => c.ai_resolved !== true).length,
          total: dayConvs.length,
        })
      }
      return stats
    },
  })

  // Agent metrics
  const { data: agentMetrics } = useQuery({
    queryKey: ['metrics', 'agents', ...filterKey],
    queryFn: async () => {
      const { data: agents, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false })

      if (error) throw error

      let convQuery = supabase
        .from('ai_conversations')
        .select('current_agent_id, status')
        .gte('started_at', periodFrom)
        .lte('started_at', periodTo)
        .or('is_discarded.is.null,is_discarded.eq.false')

      if (filters) {
        if (filters.categoryIds.length > 0) convQuery = convQuery.in('ticket_category_id', filters.categoryIds)
        if (filters.moduleIds.length > 0) convQuery = convQuery.in('ticket_module_id', filters.moduleIds)
        if (filters.boardIds.length > 0) convQuery = convQuery.in('kanban_board_id', filters.boardIds)
        if (filters.aiAgentIds.length > 0) convQuery = convQuery.in('current_agent_id', filters.aiAgentIds)
      }

      const { data: conversations } = await convQuery

      return (agents || []).map(agent => {
        const agentConvs = conversations?.filter(c => c.current_agent_id === agent.id) || []
        const resolved = agentConvs.filter(c => c.status === 'finalizado').length
        return {
          ...agent,
          todayConversations: agentConvs.length,
          todayResolved: resolved,
          todaySuccessRate: agentConvs.length > 0 ? Math.round((resolved / agentConvs.length) * 100) : 0,
        }
      })
    },
    refetchInterval: 15000,
  })

  // Recent conversations
  const { data: recentConversations, isLoading, isError, error } = useQuery({
    queryKey: ['conversations', 'recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*, ai_agents(name, color, specialty)')
        .not('status', 'eq', 'cancelado')
        .or('is_discarded.is.null,is_discarded.eq.false')
        .or('is_merged.is.null,is_merged.eq.false')
        .order('started_at', { ascending: false })
        .limit(5)

      if (error) throw error
      return data
    },
    refetchInterval: 5000,
  })

  return {
    todayStats,
    todayCosts,
    weeklyStats,
    agentMetrics,
    recentConversations,
    isLoading,
    isError,
    error,
  }
}
