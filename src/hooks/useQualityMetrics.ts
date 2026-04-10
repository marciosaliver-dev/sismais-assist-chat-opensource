import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useSLAConfig } from '@/hooks/useSLAConfig'

export type PeriodFilter = 'today' | '7d' | '30d' | 'custom'

interface QualityFilters {
  period: PeriodFilter
  customStart?: Date
  customEnd?: Date
  agentId?: string
  category?: string
  moduleIds?: string[]
  boardIds?: string[]
  aiAgentIds?: string[]
  categoryIds?: string[]
  humanAgentIds?: string[]
}

function getDateRange(filters: QualityFilters) {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date()

  switch (filters.period) {
    case 'today':
      start.setHours(0, 0, 0, 0)
      break
    case '7d':
      start.setDate(start.getDate() - 6)
      start.setHours(0, 0, 0, 0)
      break
    case '30d':
      start.setDate(start.getDate() - 29)
      start.setHours(0, 0, 0, 0)
      break
    case 'custom':
      if (filters.customStart) {
        start.setTime(filters.customStart.getTime())
        start.setHours(0, 0, 0, 0)
      }
      if (filters.customEnd) {
        end.setTime(filters.customEnd.getTime())
        end.setHours(23, 59, 59, 999)
      }
      break
  }
  return { start: start.toISOString(), end: end.toISOString() }
}

const QUEUE_STATUSES = ['aguardando']
const FINISHED_STATUSES = ['finalizado']
const IN_PROGRESS_STATUSES = ['em_atendimento']

export function useQualityMetrics(filters: QualityFilters) {
  const { start, end } = getDateRange(filters)
  const { data: slaConfig } = useSLAConfig()

  // Main conversations query
  const { data: conversations, isLoading: loadingConvs } = useQuery({
    queryKey: ['quality-conversations', start, end, filters.agentId, filters.category, filters.categoryIds, filters.moduleIds, filters.boardIds, filters.humanAgentIds, filters.aiAgentIds],
    queryFn: async () => {
      let query = supabase
        .from('ai_conversations')
        .select('id, started_at, status, priority, resolution_seconds, first_human_response_seconds, csat_score, csat_rating, human_agent_id, ticket_category_id, helpdesk_client_id, resolved_at, agent_switches_count, human_started_at, ai_resolved, queue_entered_at')
        .gte('started_at', start)
        .lte('started_at', end)

      if (filters.agentId) {
        query = query.eq('human_agent_id', filters.agentId)
      }
      if (filters.category) {
        query = query.eq('ticket_category_id', filters.category)
      }

      if (!filters.category && filters.categoryIds && filters.categoryIds.length > 0) {
        query = query.in('ticket_category_id', filters.categoryIds)
      }
      if (filters.moduleIds && filters.moduleIds.length > 0) {
        query = query.in('ticket_module_id', filters.moduleIds)
      }
      if (filters.boardIds && filters.boardIds.length > 0) {
        query = query.in('kanban_board_id', filters.boardIds)
      }
      if (!filters.agentId && filters.humanAgentIds && filters.humanAgentIds.length > 0) {
        query = query.in('human_agent_id', filters.humanAgentIds)
      }
      if (filters.aiAgentIds && filters.aiAgentIds.length > 0) {
        query = query.in('current_agent_id', filters.aiAgentIds)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
  })

  // Queue count (real-time)
  const { data: queueCount } = useQuery({
    queryKey: ['quality-queue-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('ai_conversations')
        .select('id', { count: 'exact', head: true })
        .in('status', QUEUE_STATUSES)
      if (error) throw error
      return count || 0
    },
    refetchInterval: 10000,
  })

  // Human agents
  const { data: agents } = useQuery({
    queryKey: ['quality-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('human_agents')
        .select('id, name')
        .order('name')
      if (error) throw error
      return data || []
    },
    staleTime: 60000,
  })

  // Categories
  const { data: categories } = useQuery({
    queryKey: ['quality-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_categories' as any)
        .select('id, name')
        .order('name')
      if (error) throw error
      return (data as unknown as { id: string; name: string }[]) || []
    },
    staleTime: 60000,
  })

  // Compute KPIs
  const allConvs = conversations || []
  const humanKpis = computeHumanKPIs(allConvs, slaConfig)
  const aiKpis = computeAIKPIs(allConvs)
  const kpis = computeKPIs(allConvs, slaConfig)
  const dailyTrends = computeDailyTrends(allConvs)
  const statusByDay = computeStatusByDay(allConvs)
  const agentStats = computeAgentStats(allConvs, agents || [], slaConfig)
  const csatDistribution = computeCsatDistribution(allConvs)
  const hourlyVolume = computeHourlyVolume(allConvs)

  return {
    kpis,
    humanKpis,
    aiKpis,
    queueCount: queueCount || 0,
    dailyTrends,
    statusByDay,
    agentStats,
    csatDistribution,
    hourlyVolume,
    agents: agents || [],
    categories: categories || [],
    isLoading: loadingConvs,
  }
}

function computeKPIs(conversations: any[], slaConfig?: Map<string, any>) {
  const finished = conversations.filter(c => FINISHED_STATUSES.includes(c.status))
  const withResolution = finished.filter(c => c.resolution_seconds != null && c.human_started_at != null)
  const withResponse = conversations.filter(c => c.first_human_response_seconds != null)
  const withCsat = conversations.filter(c => c.csat_score != null)

  const tma = withResolution.length > 0
    ? Math.round(withResolution.reduce((a, c) => a + c.resolution_seconds, 0) / withResolution.length)
    : 0

  const tme = withResponse.length > 0
    ? Math.round(withResponse.reduce((a, c) => a + c.first_human_response_seconds, 0) / withResponse.length)
    : 0

  const csatAvg = withCsat.length > 0
    ? Math.round(withCsat.reduce((a, c) => a + c.csat_score, 0) / withCsat.length * 10) / 10
    : 0

  const csatSatisfied = withCsat.filter(c => c.csat_score >= 4).length
  const csatSatisfactionRate = withCsat.length > 0
    ? Math.round((csatSatisfied / withCsat.length) * 1000) / 10
    : 0

  // SLA histórico (compliance de tickets já respondidos — inclui finalizados)
  let slaCompliant = 0
  let slaTotal = 0
  if (slaConfig) {
    for (const c of withResponse) {
      const config = slaConfig.get(c.priority || 'medium')
      if (config) {
        slaTotal++
        const responseMinutes = c.first_human_response_seconds / 60
        if (responseMinutes <= config.first_response_target_minutes) {
          slaCompliant++
        }
      }
    }
  }
  const slaRate = slaTotal > 0 ? Math.round((slaCompliant / slaTotal) * 1000) / 10 : 0

  // SLA ativo (tickets abertos em risco — exclui finalizados)
  let activeSlaAtRisk = 0
  const activeConvs = conversations.filter(c => !FINISHED_STATUSES.includes(c.status))
  if (slaConfig) {
    const now = Date.now()
    for (const c of activeConvs) {
      if (c.first_human_response_seconds != null) continue // já respondido
      if (!c.queue_entered_at) continue
      const config = slaConfig.get(c.priority || 'medium')
      if (!config) continue
      const elapsedMinutes = (now - new Date(c.queue_entered_at).getTime()) / 60000
      if (elapsedMinutes >= config.first_response_target_minutes * 0.8) {
        activeSlaAtRisk++
      }
    }
  }

  // FCR
  const fcrEligible = finished.filter(c => c.human_agent_id != null)
  const fcrResolved = fcrEligible.filter(c => (c.agent_switches_count || 0) <= 1)
  const fcrRate = fcrEligible.length > 0
    ? Math.round((fcrResolved.length / fcrEligible.length) * 1000) / 10
    : 0

  return {
    tma,
    tme,
    csatAvg,
    csatSatisfactionRate,
    slaRate,
    fcrRate,
    totalFinished: finished.length,
    csatCount: withCsat.length,
    activeSlaAtRisk,
  }
}

function computeHumanKPIs(conversations: any[], slaConfig?: Map<string, any>) {
  const humanConvs = conversations.filter(c => c.human_started_at != null)
  const finished = humanConvs.filter(c => FINISHED_STATUSES.includes(c.status))
  const withResolution = finished.filter(c => c.resolution_seconds != null)
  const withResponse = humanConvs.filter(c => c.first_human_response_seconds != null)
  const withCsat = humanConvs.filter(c => c.csat_score != null)

  const tprh = withResponse.length > 0
    ? Math.round(withResponse.reduce((a, c) => a + c.first_human_response_seconds, 0) / withResponse.length)
    : 0

  const tma = withResolution.length > 0
    ? Math.round(withResolution.reduce((a, c) => a + c.resolution_seconds, 0) / withResolution.length)
    : 0

  const csatAvg = withCsat.length > 0
    ? Math.round(withCsat.reduce((a, c) => a + c.csat_score, 0) / withCsat.length * 10) / 10
    : 0

  // SLA
  let slaCompliant = 0
  let slaTotal = 0
  if (slaConfig) {
    for (const c of withResponse) {
      const config = slaConfig.get(c.priority || 'medium')
      if (config) {
        slaTotal++
        if (c.first_human_response_seconds / 60 <= config.first_response_target_minutes) slaCompliant++
      }
    }
  }
  const slaRate = slaTotal > 0 ? Math.round((slaCompliant / slaTotal) * 1000) / 10 : 0

  return { tprh, tma, csatAvg, slaRate, totalFinished: finished.length }
}

function computeAIKPIs(conversations: any[]) {
  const total = conversations.length
  const aiResolved = conversations.filter(c => c.ai_resolved === true)
  const withCsat = aiResolved.filter(c => c.csat_score != null)

  const csatAvg = withCsat.length > 0
    ? Math.round(withCsat.reduce((a, c) => a + c.csat_score, 0) / withCsat.length * 10) / 10
    : 0

  const resolutionRate = total > 0
    ? Math.round((aiResolved.length / total) * 1000) / 10
    : 0

  return { totalResolved: aiResolved.length, resolutionRate, csatAvg }
}

function computeDailyTrends(conversations: any[]) {
  const byDay = new Map<string, { csatSum: number; csatCount: number; tmaSum: number; tmaCount: number }>()

  for (const c of conversations) {
    const day = new Date(c.started_at).toISOString().slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, { csatSum: 0, csatCount: 0, tmaSum: 0, tmaCount: 0 })
    const d = byDay.get(day)!
    if (c.csat_score != null) { d.csatSum += c.csat_score; d.csatCount++ }
    if (c.resolution_seconds != null && FINISHED_STATUSES.includes(c.status)) { d.tmaSum += c.resolution_seconds; d.tmaCount++ }
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      csat: d.csatCount > 0 ? Math.round(d.csatSum / d.csatCount * 10) / 10 : null,
      tma: d.tmaCount > 0 ? Math.round(d.tmaSum / d.tmaCount / 60) : null, // in minutes
    }))
}

function computeStatusByDay(conversations: any[]) {
  const byDay = new Map<string, { pendente: number; em_atendimento: number; finalizado: number }>()

  for (const c of conversations) {
    const day = new Date(c.started_at).toISOString().slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, { pendente: 0, em_atendimento: 0, finalizado: 0 })
    const d = byDay.get(day)!
    if (QUEUE_STATUSES.includes(c.status)) d.pendente++
    else if (IN_PROGRESS_STATUSES.includes(c.status)) d.em_atendimento++
    else if (FINISHED_STATUSES.includes(c.status)) d.finalizado++
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      ...d,
    }))
}

function computeAgentStats(conversations: any[], agents: { id: string; name: string }[], slaConfig?: Map<string, any>) {
  const agentMap = new Map(agents.map(a => [a.id, a.name]))
  const byAgent = new Map<string, any[]>()

  for (const c of conversations) {
    if (!c.human_agent_id) continue
    if (!byAgent.has(c.human_agent_id)) byAgent.set(c.human_agent_id, [])
    byAgent.get(c.human_agent_id)!.push(c)
  }

  return Array.from(byAgent.entries()).map(([agentId, convs]) => {
    const finished = convs.filter(c => FINISHED_STATUSES.includes(c.status))
    const withRes = finished.filter(c => c.resolution_seconds != null)
    const withResp = convs.filter(c => c.first_human_response_seconds != null)
    const withCsat = convs.filter(c => c.csat_score != null)
    const openNow = convs.filter(c => !FINISHED_STATUSES.includes(c.status)).length

    let slaOk = 0, slaTotal = 0
    if (slaConfig) {
      for (const c of withResp) {
        const cfg = slaConfig.get(c.priority || 'medium')
        if (cfg) {
          slaTotal++
          if (c.first_human_response_seconds / 60 <= cfg.first_response_target_minutes) slaOk++
        }
      }
    }

    return {
      id: agentId,
      name: agentMap.get(agentId) || 'Desconhecido',
      tickets: convs.length,
      tma: withRes.length > 0 ? Math.round(withRes.reduce((a, c) => a + c.resolution_seconds, 0) / withRes.length) : 0,
      tme: withResp.length > 0 ? Math.round(withResp.reduce((a, c) => a + c.first_human_response_seconds, 0) / withResp.length) : 0,
      csat: withCsat.length > 0 ? Math.round(withCsat.reduce((a, c) => a + c.csat_score, 0) / withCsat.length * 10) / 10 : 0,
      slaRate: slaTotal > 0 ? Math.round((slaOk / slaTotal) * 1000) / 10 : 0,
      openNow,
    }
  }).sort((a, b) => b.tickets - a.tickets)
}

function computeCsatDistribution(conversations: any[]) {
  const counts = [0, 0, 0, 0, 0]
  for (const c of conversations) {
    if (c.csat_score != null && c.csat_score >= 1 && c.csat_score <= 5) {
      counts[c.csat_score - 1]++
    }
  }
  return counts.map((count, i) => ({ score: i + 1, count }))
}

function computeHourlyVolume(conversations: any[]) {
  const hours = new Array(24).fill(0)
  for (const c of conversations) {
    const h = new Date(c.started_at).getHours()
    hours[h]++
  }
  return hours.map((count, hour) => ({ hour: `${hour}h`, count }))
}

export function formatCompactTime(seconds: number) {
  if (!seconds) return '--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
