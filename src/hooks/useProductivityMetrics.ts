import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { DashboardFilters } from '@/contexts/DashboardFilterContext'
import { applyDashboardFilters } from '@/lib/dashboard-query-helpers'

const CUSTO_HORA_HUMANO_BRL = 25
const USD_TO_BRL = 5.8

export interface ProductivityKPI {
  value: number | string
  previousValue: number | string
  deltaPercent: number | null
  isPositive: boolean // se a variacao e boa (true) ou ruim (false)
}

export interface FCRByCategory {
  categoryId: string
  categoryName: string
  categoryColor: string | null
  total: number
  fcrCount: number
  fcrRate: number
}

export interface AgentScore {
  agentId: string
  agentName: string
  agentType: 'ia' | 'humano'
  tickets: number
  fcrRate: number
  tmaSeconds: number
  csat: number
  escalations: number
  score: number
}

export interface CostByCategory {
  categoryName: string
  avgCostBrl: number
  totalCostBrl: number
  count: number
}

export interface WeeklyAITrend {
  week: string
  aiResolved: number
  total: number
  aiRate: number
}

export interface ProductivityMetrics {
  // KPIs com comparativo
  throughput: ProductivityKPI
  fcrRate: ProductivityKPI
  costPerResolutionAI: ProductivityKPI
  economyAI: ProductivityKPI
  backlogVelocity: ProductivityKPI
  handleTime: ProductivityKPI
  escalationRate: ProductivityKPI
  reopenRate: ProductivityKPI
  oneTouchRate: ProductivityKPI
  csatTrend: ProductivityKPI
  // Breakdowns
  fcrByCategory: FCRByCategory[]
  agentScores: AgentScore[]
  costByCategory: CostByCategory[]
  // ROI
  aiTicketsDeviated: number
  aiEconomyHours: number
  aiSuccessRate: number
  aiEconomyBrl: number
  aiWeeklyTrend: WeeklyAITrend[]
  // Custo
  aiCostPerTicketBrl: number
  aiTotalCostBrl: number
  aiTotalResolved: number
  humanCostPerTicketBrl: number
  humanTotalResolved: number
  totalEconomyBrl: number
}

function computeDelta(current: number, previous: number): { deltaPercent: number | null } {
  if (previous === 0) return { deltaPercent: current > 0 ? 100 : null }
  return { deltaPercent: Math.round(((current - previous) / previous) * 100) }
}

export function useProductivityMetrics(filters: DashboardFilters) {
  const periodFrom = filters.period.from.toISOString()
  const periodTo = filters.period.to.toISOString()

  // Periodo anterior de mesma duracao
  const durationMs = filters.period.to.getTime() - filters.period.from.getTime()
  const prevFrom = new Date(filters.period.from.getTime() - durationMs).toISOString()
  const prevTo = new Date(filters.period.from.getTime() - 1).toISOString()

  const filterKey = [
    filters.period.preset, periodFrom, periodTo,
    filters.categoryIds, filters.moduleIds, filters.boardIds,
    filters.humanAgentIds, filters.aiAgentIds,
  ]

  const { data, isLoading } = useQuery({
    queryKey: ['productivity-metrics', ...filterKey],
    queryFn: async (): Promise<ProductivityMetrics> => {
      // Periodo atual
      let currentQuery = supabase
        .from('ai_conversations')
        .select('id, status, ai_resolved, resolution_seconds, first_human_response_seconds, agent_switches_count, csat_rating, reopened_at, ticket_category_id, human_agent_id, current_agent_id, handler_type, ai_messages_count, started_at, resolved_at')

      currentQuery = applyDashboardFilters(currentQuery, filters)
      const { data: current, error: currentErr } = await currentQuery
      if (currentErr) throw currentErr
      const convs = current || []

      // Periodo anterior
      let prevQuery = supabase
        .from('ai_conversations')
        .select('id, status, ai_resolved, resolution_seconds, agent_switches_count, csat_rating, reopened_at, handler_type, ai_messages_count, started_at, resolved_at')
        .gte('started_at', prevFrom)
        .lte('started_at', prevTo)
        .or('is_discarded.is.null,is_discarded.eq.false')

      if (filters.categoryIds.length > 0) prevQuery = prevQuery.in('ticket_category_id', filters.categoryIds)
      if (filters.moduleIds.length > 0) prevQuery = prevQuery.in('ticket_module_id', filters.moduleIds)
      if (filters.boardIds.length > 0) prevQuery = prevQuery.in('kanban_board_id', filters.boardIds)
      if (filters.humanAgentIds.length > 0) prevQuery = prevQuery.in('human_agent_id', filters.humanAgentIds)
      if (filters.aiAgentIds.length > 0) prevQuery = prevQuery.in('current_agent_id', filters.aiAgentIds)

      const { data: prev } = await prevQuery
      const prevConvs = prev || []

      // Custos IA do periodo
      const { data: aiCosts } = await supabase
        .from('ai_messages')
        .select('conversation_id, cost_usd')
        .gte('created_at', periodFrom)
        .lte('created_at', periodTo)
        .not('cost_usd', 'is', null)

      // Categorias lookup
      const { data: categories } = await supabase
        .from('ticket_categories')
        .select('id, name, color')
        .eq('active', true)

      // Agentes lookup
      const { data: humanAgents } = await supabase
        .from('human_agents')
        .select('id, name')
      const { data: aiAgents } = await supabase
        .from('ai_agents')
        .select('id, name')

      const catMap = new Map((categories || []).map(c => [c.id, c]))
      const humanMap = new Map((humanAgents || []).map(a => [a.id, a.name]))
      const aiMap = new Map((aiAgents || []).map(a => [a.id, a.name]))

      // Helpers
      const finished = convs.filter(c => c.status === 'finalizado')
      const prevFinished = prevConvs.filter(c => c.status === 'finalizado')
      const aiResolved = convs.filter(c => c.ai_resolved === true)
      const prevAiResolved = prevConvs.filter(c => c.ai_resolved === true)

      // --- KPIs ---
      const hoursInPeriod = Math.max(1, durationMs / 3600000)
      const throughputCurr = finished.length / hoursInPeriod
      const throughputPrev = prevFinished.length / Math.max(1, (new Date(prevTo).getTime() - new Date(prevFrom).getTime()) / 3600000)

      const fcrCurr = finished.length > 0 ? finished.filter(c => (c.agent_switches_count || 0) <= 1).length / finished.length * 100 : 0
      const fcrPrev = prevFinished.length > 0 ? prevFinished.filter(c => (c.agent_switches_count || 0) <= 1).length / prevFinished.length * 100 : 0

      // Custo IA
      const totalAiCostUsd = (aiCosts || []).reduce((s, m) => s + Number(m.cost_usd || 0), 0)
      const totalAiCostBrl = totalAiCostUsd * USD_TO_BRL
      const aiResolvedCount = aiResolved.filter(c => c.status === 'finalizado').length
      const aiCostPerTicketBrl = aiResolvedCount > 0 ? totalAiCostBrl / aiResolvedCount : 0

      // TMA
      const tmaCurr = finished.length > 0
        ? finished.reduce((s, c) => s + (c.resolution_seconds || 0), 0) / finished.length
        : 0
      const tmaPrev = prevFinished.length > 0
        ? prevFinished.reduce((s, c) => s + (c.resolution_seconds || 0), 0) / prevFinished.length
        : 0

      // Custo humano estimado
      const humanResolved = finished.filter(c => c.ai_resolved !== true)
      const humanTmaAvg = humanResolved.length > 0
        ? humanResolved.reduce((s, c) => s + (c.resolution_seconds || 0), 0) / humanResolved.length
        : 0
      const humanCostPerTicketBrl = humanTmaAvg > 0 ? (humanTmaAvg / 3600) * CUSTO_HORA_HUMANO_BRL : 0

      // Economia IA
      const economyCurr = aiResolvedCount * humanCostPerTicketBrl - totalAiCostBrl
      const prevAiResolvedFinished = prevAiResolved.filter(c => c.status === 'finalizado').length
      const economyPrev = prevAiResolvedFinished * humanCostPerTicketBrl - 0 // simplificado

      // Escalation
      const escalCurr = convs.length > 0 ? convs.filter(c => c.handler_type === 'hybrid').length / convs.length * 100 : 0
      const escalPrev = prevConvs.length > 0 ? prevConvs.filter(c => c.handler_type === 'hybrid').length / prevConvs.length * 100 : 0

      // Reopen
      const reopenCurr = finished.length > 0 ? finished.filter(c => c.reopened_at).length / finished.length * 100 : 0
      const reopenPrev = prevFinished.length > 0 ? prevFinished.filter(c => c.reopened_at).length / prevFinished.length * 100 : 0

      // One-Touch
      const oneTouchCurr = finished.length > 0 ? finished.filter(c => (c.ai_messages_count || 0) <= 2).length / finished.length * 100 : 0
      const oneTouchPrev = prevFinished.length > 0 ? prevFinished.filter(c => (c.ai_messages_count || 0) <= 2).length / prevFinished.length * 100 : 0

      // CSAT
      const csatWith = convs.filter(c => c.csat_rating)
      const csatCurr = csatWith.length > 0 ? csatWith.reduce((s, c) => s + (c.csat_rating || 0), 0) / csatWith.length : 0
      const prevCsatWith = prevConvs.filter(c => c.csat_rating)
      const csatPrev = prevCsatWith.length > 0 ? prevCsatWith.reduce((s, c) => s + (c.csat_rating || 0), 0) / prevCsatWith.length : 0

      // Backlog velocity (entradas - saidas por dia)
      const daysInPeriod = Math.max(1, durationMs / 86400000)
      const entriesPerDay = convs.length / daysInPeriod
      const exitsPerDay = finished.length / daysInPeriod
      const velocityCurr = Math.round((entriesPerDay - exitsPerDay) * 10) / 10
      const prevDays = Math.max(1, (new Date(prevTo).getTime() - new Date(prevFrom).getTime()) / 86400000)
      const velocityPrev = Math.round(((prevConvs.length / prevDays) - (prevFinished.length / prevDays)) * 10) / 10

      // --- FCR por Categoria ---
      const catGroups = new Map<string, { total: number; fcr: number }>()
      for (const c of finished) {
        const catId = c.ticket_category_id || 'sem-categoria'
        if (!catGroups.has(catId)) catGroups.set(catId, { total: 0, fcr: 0 })
        const g = catGroups.get(catId)!
        g.total++
        if ((c.agent_switches_count || 0) <= 1) g.fcr++
      }
      const fcrByCategory: FCRByCategory[] = Array.from(catGroups.entries())
        .map(([catId, g]) => ({
          categoryId: catId,
          categoryName: catMap.get(catId)?.name || 'Sem categoria',
          categoryColor: catMap.get(catId)?.color || null,
          total: g.total,
          fcrCount: g.fcr,
          fcrRate: g.total > 0 ? Math.round((g.fcr / g.total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)

      // --- Agent Scores ---
      const agentGroups = new Map<string, { type: 'ia' | 'humano'; tickets: number; fcr: number; tmaSum: number; tmaCount: number; csatSum: number; csatCount: number; escalations: number }>()

      for (const c of finished) {
        const agentId = c.human_agent_id || c.current_agent_id
        if (!agentId) continue
        const type = c.human_agent_id ? 'humano' : 'ia'
        if (!agentGroups.has(agentId)) {
          agentGroups.set(agentId, { type, tickets: 0, fcr: 0, tmaSum: 0, tmaCount: 0, csatSum: 0, csatCount: 0, escalations: 0 })
        }
        const g = agentGroups.get(agentId)!
        g.tickets++
        if ((c.agent_switches_count || 0) <= 1) g.fcr++
        if (c.resolution_seconds) { g.tmaSum += c.resolution_seconds; g.tmaCount++ }
        if (c.csat_rating) { g.csatSum += c.csat_rating; g.csatCount++ }
        if (c.handler_type === 'hybrid') g.escalations++
      }

      const maxTma = Math.max(...Array.from(agentGroups.values()).map(g => g.tmaCount > 0 ? g.tmaSum / g.tmaCount : 0), 1)

      const agentScores: AgentScore[] = Array.from(agentGroups.entries())
        .map(([id, g]) => {
          const fcrR = g.tickets > 0 ? g.fcr / g.tickets * 100 : 0
          const tma = g.tmaCount > 0 ? g.tmaSum / g.tmaCount : 0
          const csat = g.csatCount > 0 ? g.csatSum / g.csatCount : 0
          const speedNorm = maxTma > 0 ? (1 - tma / maxTma) * 100 : 0
          const csatNorm = csat / 5 * 100
          const score = Math.round(fcrR * 0.4 + csatNorm * 0.3 + speedNorm * 0.3)
          const name = g.type === 'humano' ? humanMap.get(id) : aiMap.get(id)
          return {
            agentId: id,
            agentName: name || 'Desconhecido',
            agentType: g.type,
            tickets: g.tickets,
            fcrRate: Math.round(fcrR),
            tmaSeconds: Math.round(tma),
            csat: Math.round(csat * 10) / 10,
            escalations: g.escalations,
            score: Math.max(0, Math.min(100, score)),
          }
        })
        .sort((a, b) => b.score - a.score)

      // --- Cost by Category ---
      const costConvMap = new Map<string, string>()
      for (const c of convs) {
        if (c.ticket_category_id) costConvMap.set(c.id, c.ticket_category_id)
      }
      const catCosts = new Map<string, { total: number; count: number }>()
      for (const m of aiCosts || []) {
        const catId = costConvMap.get(m.conversation_id)
        if (!catId) continue
        if (!catCosts.has(catId)) catCosts.set(catId, { total: 0, count: 0 })
        const g = catCosts.get(catId)!
        g.total += Number(m.cost_usd || 0) * USD_TO_BRL
        g.count++
      }
      const costByCategory: CostByCategory[] = Array.from(catCosts.entries())
        .map(([catId, g]) => ({
          categoryName: catMap.get(catId)?.name || 'Sem categoria',
          avgCostBrl: g.count > 0 ? Math.round((g.total / g.count) * 100) / 100 : 0,
          totalCostBrl: Math.round(g.total * 100) / 100,
          count: g.count,
        }))
        .sort((a, b) => b.totalCostBrl - a.totalCostBrl)
        .slice(0, 8)

      // --- ROI Automacoes ---
      const aiSuccessRate = convs.filter(c => c.handler_type === 'ai' || c.ai_resolved).length > 0
        ? Math.round(aiResolvedCount / convs.filter(c => c.handler_type === 'ai' || c.ai_resolved).length * 100)
        : 0
      const aiEconomyHours = Math.round(aiResolvedCount * (humanTmaAvg / 3600) * 10) / 10

      // Weekly AI trend (8 semanas)
      const eightWeeksAgo = new Date()
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)
      const { data: weeklyConvs } = await supabase
        .from('ai_conversations')
        .select('started_at, ai_resolved, status')
        .gte('started_at', eightWeeksAgo.toISOString())
        .eq('status', 'finalizado')
        .or('is_discarded.is.null,is_discarded.eq.false')

      const weekMap = new Map<string, { ai: number; total: number }>()
      for (const c of weeklyConvs || []) {
        const d = new Date(c.started_at!)
        const weekStart = new Date(d)
        weekStart.setDate(d.getDate() - d.getDay())
        const key = weekStart.toISOString().slice(0, 10)
        if (!weekMap.has(key)) weekMap.set(key, { ai: 0, total: 0 })
        const w = weekMap.get(key)!
        w.total++
        if (c.ai_resolved) w.ai++
      }
      const aiWeeklyTrend: WeeklyAITrend[] = Array.from(weekMap.entries())
        .map(([week, w]) => ({
          week: new Date(week).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          aiResolved: w.ai,
          total: w.total,
          aiRate: w.total > 0 ? Math.round((w.ai / w.total) * 100) : 0,
        }))
        .sort((a, b) => a.week.localeCompare(b.week))

      // Build KPIs
      const mkKpi = (curr: number, prev: number, inverted = false): ProductivityKPI => {
        const d = computeDelta(curr, prev)
        return {
          value: curr,
          previousValue: prev,
          deltaPercent: d.deltaPercent,
          isPositive: inverted ? (d.deltaPercent !== null && d.deltaPercent <= 0) : (d.deltaPercent !== null && d.deltaPercent >= 0),
        }
      }

      return {
        throughput: { ...mkKpi(Math.round(throughputCurr * 10) / 10, Math.round(throughputPrev * 10) / 10), value: `${(Math.round(throughputCurr * 10) / 10).toFixed(1)}/h` } as any,
        fcrRate: mkKpi(Math.round(fcrCurr), Math.round(fcrPrev)),
        costPerResolutionAI: { ...mkKpi(Math.round(aiCostPerTicketBrl * 100) / 100, 0), value: `R$ ${aiCostPerTicketBrl.toFixed(2)}` } as any,
        economyAI: { ...mkKpi(Math.round(economyCurr), Math.round(economyPrev)), value: `R$ ${Math.round(economyCurr)}` } as any,
        backlogVelocity: { ...mkKpi(velocityCurr, velocityPrev, true), value: velocityCurr > 0 ? `+${velocityCurr}/dia` : `${velocityCurr}/dia` } as any,
        handleTime: mkKpi(Math.round(tmaCurr), Math.round(tmaPrev), true),
        escalationRate: mkKpi(Math.round(escalCurr), Math.round(escalPrev), true),
        reopenRate: mkKpi(Math.round(reopenCurr), Math.round(reopenPrev), true),
        oneTouchRate: mkKpi(Math.round(oneTouchCurr), Math.round(oneTouchPrev)),
        csatTrend: mkKpi(Math.round(csatCurr * 10) / 10, Math.round(csatPrev * 10) / 10),
        fcrByCategory,
        agentScores,
        costByCategory,
        aiTicketsDeviated: aiResolvedCount,
        aiEconomyHours,
        aiSuccessRate,
        aiEconomyBrl: Math.round(economyCurr),
        aiWeeklyTrend,
        aiCostPerTicketBrl: Math.round(aiCostPerTicketBrl * 100) / 100,
        aiTotalCostBrl: Math.round(totalAiCostBrl * 100) / 100,
        aiTotalResolved: aiResolvedCount,
        humanCostPerTicketBrl: Math.round(humanCostPerTicketBrl * 100) / 100,
        humanTotalResolved: humanResolved.length,
        totalEconomyBrl: Math.round(economyCurr),
      }
    },
    refetchInterval: 30000,
  })

  return { data, isLoading }
}
