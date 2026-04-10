import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useMemo } from 'react'

export interface StageMetric {
  stageId: string
  stageName: string
  sortOrder: number
  wipLimit: number | null
  color: string
  statusType: string | null
  ticketCount: number
  avgTimeMs: number
  minTimeMs: number
  maxTimeMs: number
  wipPercentage: number | null
  entered: number
  exited: number
  isBottleneck: boolean
}

interface HistoryRecord {
  id: string
  conversation_id: string
  from_id: string | null
  to_id: string | null
  from_value: string | null
  to_value: string | null
  created_at: string
}

interface Stage {
  id: string
  name: string
  sort_order: number
  wip_limit: number | null
  color: string
  board_id: string
  status_type: string | null
}

export interface StageTimeGlobalFilters {
  categoryIds?: string[]
  moduleIds?: string[]
  boardIds?: string[]
  humanAgentIds?: string[]
  aiAgentIds?: string[]
}

export function useStageTimeMetrics(
  boardId: string | null,
  startDate: Date,
  endDate: Date,
  agentId: string | null,
  categoryId: string | null,
  globalFilters?: StageTimeGlobalFilters
) {
  const stagesQuery = useQuery({
    queryKey: ['kanban-stages-for-report', boardId],
    queryFn: async () => {
      if (!boardId) return []
      const { data, error } = await (supabase as any)
        .from('kanban_stages')
        .select('id, name, sort_order, wip_limit, color, board_id, status_type')
        .eq('board_id', boardId)
        .eq('active', true)
        .order('sort_order')
      if (error) throw error
      return (data || []) as Stage[]
    },
    enabled: !!boardId,
  })

  const historyQuery = useQuery({
    queryKey: ['stage-time-history', boardId, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ticket_status_history')
        .select('id, conversation_id, from_id, to_id, from_value, to_value, created_at')
        .eq('change_type', 'stage_change')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('conversation_id')
        .order('created_at')
      if (error) throw error
      return (data || []) as HistoryRecord[]
    },
    enabled: !!boardId,
  })

  // Filter by agent/category + global filters
  const gf = globalFilters
  const hasGlobalFilters = !!(
    gf?.categoryIds?.length ||
    gf?.moduleIds?.length ||
    gf?.boardIds?.length ||
    gf?.humanAgentIds?.length ||
    gf?.aiAgentIds?.length
  )
  const filteredConvsQuery = useQuery({
    queryKey: ['filtered-convs-stage', agentId, categoryId, gf?.categoryIds, gf?.moduleIds, gf?.boardIds, gf?.humanAgentIds, gf?.aiAgentIds],
    queryFn: async () => {
      let query = (supabase as any)
        .from('ai_conversations')
        .select('id')
      if (agentId) query = query.eq('human_agent_id', agentId)
      if (categoryId) query = query.eq('ticket_category_id', categoryId)
      // Global filters
      if (gf?.categoryIds?.length) query = query.in('ticket_category_id', gf.categoryIds)
      if (gf?.moduleIds?.length) query = query.in('ticket_module_id', gf.moduleIds)
      if (gf?.boardIds?.length) query = query.in('kanban_board_id', gf.boardIds)
      if (gf?.humanAgentIds?.length) query = query.in('human_agent_id', gf.humanAgentIds)
      if (gf?.aiAgentIds?.length) query = query.in('agent_id', gf.aiAgentIds)
      const { data, error } = await query
      if (error) throw error
      return new Set((data || []).map((d: any) => d.id))
    },
    enabled: !!(agentId || categoryId || hasGlobalFilters),
  })

  const agentsQuery = useQuery({
    queryKey: ['human-agents-filter'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('human_agents')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data || []
    },
  })

  const categoriesQuery = useQuery({
    queryKey: ['ticket-categories-filter'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ticket_categories')
        .select('id, name')
        .order('name')
      if (error) throw error
      return data || []
    },
  })

  const metrics = useMemo<StageMetric[]>(() => {
    const stages = stagesQuery.data
    const history = historyQuery.data
    if (!stages?.length || !history?.length) return []

    const stageIds = new Set(stages.map((s) => s.id))

    // Filter history to only records belonging to this board's stages
    let filtered = history.filter(
      (r) => (r.to_id && stageIds.has(r.to_id)) || (r.from_id && stageIds.has(r.from_id))
    )

    // Filter by agent/category/global filters
    if ((agentId || categoryId || hasGlobalFilters) && filteredConvsQuery.data) {
      const allowedConvs = filteredConvsQuery.data
      filtered = filtered.filter((r) => allowedConvs.has(r.conversation_id))
    }

    // Group by conversation
    const byConv = new Map<string, HistoryRecord[]>()
    for (const r of filtered) {
      const arr = byConv.get(r.conversation_id) || []
      arr.push(r)
      byConv.set(r.conversation_id, arr)
    }

    const now = Date.now()

    // Calculate per-stage metrics
    return stages.map((stage) => {
      const times: number[] = []
      let entered = 0
      let exited = 0

      for (const [, records] of byConv) {
        for (let i = 0; i < records.length; i++) {
          const r = records[i]
          if (r.to_id === stage.id) {
            entered++
            // Find next exit
            const entryTime = new Date(r.created_at).getTime()
            let exitTime: number | null = null
            for (let j = i + 1; j < records.length; j++) {
              if (records[j].from_id === stage.id) {
                exitTime = new Date(records[j].created_at).getTime()
                exited++
                break
              }
            }
            const duration = (exitTime || now) - entryTime
            if (duration > 0) times.push(duration)
          }
        }
      }

      const avgTimeMs = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0
      const minTimeMs = times.length ? Math.min(...times) : 0
      const maxTimeMs = times.length ? Math.max(...times) : 0

      const isFinalizado = stage.status_type === 'finalizado'

      return {
        stageId: stage.id,
        stageName: stage.name,
        sortOrder: stage.sort_order,
        wipLimit: stage.wip_limit,
        color: stage.color,
        statusType: stage.status_type,
        ticketCount: entered,
        avgTimeMs: isFinalizado ? 0 : avgTimeMs,
        minTimeMs: isFinalizado ? 0 : minTimeMs,
        maxTimeMs: isFinalizado ? 0 : maxTimeMs,
        wipPercentage: null, // simplified
        entered,
        exited,
        isBottleneck: false, // computed below
      }
    })
  }, [stagesQuery.data, historyQuery.data, filteredConvsQuery.data, agentId, categoryId, hasGlobalFilters])

  // Mark bottlenecks
  const enrichedMetrics = useMemo(() => {
    if (!metrics.length) return metrics
    const withData = metrics.filter((m) => m.ticketCount > 0)
    if (!withData.length) return metrics
    const globalAvg = withData.reduce((a, b) => a + b.avgTimeMs, 0) / withData.length
    return metrics.map((m) => ({
      ...m,
      isBottleneck: m.avgTimeMs > globalAvg * 1.5 && m.ticketCount > 0,
    }))
  }, [metrics])

  const activeMetrics = enrichedMetrics.filter((m) => m.statusType !== 'finalizado')
  const totalPipelineTime = activeMetrics.reduce((a, b) => a + b.avgTimeMs, 0)
  const slowestStage = activeMetrics.reduce<StageMetric | null>(
    (best, m) => (!best || m.avgTimeMs > best.avgTimeMs ? m : best),
    null
  )
  const totalTickets = new Set(
    (historyQuery.data || []).map((r) => r.conversation_id)
  ).size
  const bottleneckCount = enrichedMetrics.filter((m) => m.isBottleneck).length

  return {
    metrics: enrichedMetrics,
    totalPipelineTime,
    slowestStage,
    totalTickets,
    bottleneckCount,
    agents: agentsQuery.data || [],
    categories: categoriesQuery.data || [],
    isLoading: stagesQuery.isLoading || historyQuery.isLoading,
  }
}

export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '--'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remMin = minutes % 60
  if (hours < 24) return `${hours}h ${remMin}m`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return `${days}d ${remHours}h`
}
