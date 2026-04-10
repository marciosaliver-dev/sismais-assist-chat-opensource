import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface DemandFilters {
  period: '7d' | '30d' | '90d' | 'custom'
  startDate?: string
  endDate?: string
  boardId?: string
  handlerType?: 'ai' | 'human' | 'all'
  categoryIds?: string[]
  moduleIds?: string[]
  boardIds?: string[]
  humanAgentIds?: string[]
  aiAgentIds?: string[]
}

interface CategoryCount {
  name: string
  count: number
  percentage: number
}

interface SubjectCount {
  subject: string
  count: number
  percentage: number
}

interface HeatmapEntry {
  category: string
  dayOfWeek: number
  count: number
}

interface DailyTrend {
  date: string
  count: number
}

interface DemandMetrics {
  topCategories: CategoryCount[]
  topModules: CategoryCount[]
  topSubjects: SubjectCount[]
  categoryByDayOfWeek: HeatmapEntry[]
  dailyTrend: DailyTrend[]
  totalConversations: number
  comparisonPercent: number | null
}

function getDateRange(filters: DemandFilters): { start: string; end: string } {
  const now = new Date()
  const end = now.toISOString()

  if (filters.period === 'custom' && filters.startDate && filters.endDate) {
    return { start: filters.startDate, end: filters.endDate }
  }

  const days = filters.period === '7d' ? 7 : filters.period === '30d' ? 30 : 90
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
  return { start, end }
}

function getPreviousRange(start: string, end: string): { start: string; end: string } {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  const length = e - s
  return {
    start: new Date(s - length).toISOString(),
    end: new Date(s).toISOString(),
  }
}

function normalizeSubject(s: string): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function useDemandMetrics(filters: DemandFilters) {
  const query = useQuery<DemandMetrics>({
    queryKey: ['demand-metrics', filters],
    refetchInterval: 60000,
    queryFn: async () => {
      const { start, end } = getDateRange(filters)
      const prev = getPreviousRange(start, end)

      // Build current period query
      let q = supabase
        .from('ai_conversations')
        .select('ticket_category_id, ticket_module_id, ticket_subject, started_at, handler_type, kanban_board_id, ticket_categories(name), ticket_modules(name)')
        .gte('started_at', start)
        .lte('started_at', end)
        .or('is_discarded.is.null,is_discarded.eq.false')

      if (filters.boardId) {
        q = q.eq('kanban_board_id', filters.boardId)
      }
      if (filters.handlerType && filters.handlerType !== 'all') {
        q = q.eq('handler_type', filters.handlerType)
      }
      if (filters.categoryIds?.length) {
        q = q.in('ticket_category_id', filters.categoryIds)
      }
      if (filters.moduleIds?.length) {
        q = q.in('ticket_module_id', filters.moduleIds)
      }
      if (filters.boardIds?.length) {
        q = q.in('kanban_board_id', filters.boardIds)
      }
      if (filters.humanAgentIds?.length) {
        q = q.in('human_agent_id', filters.humanAgentIds)
      }
      if (filters.aiAgentIds?.length) {
        q = q.in('current_agent_id', filters.aiAgentIds)
      }

      // Build previous period count query
      let prevQ = supabase
        .from('ai_conversations')
        .select('id', { count: 'exact', head: true })
        .gte('started_at', prev.start)
        .lte('started_at', prev.end)
        .or('is_discarded.is.null,is_discarded.eq.false')

      if (filters.boardId) {
        prevQ = prevQ.eq('kanban_board_id', filters.boardId)
      }
      if (filters.handlerType && filters.handlerType !== 'all') {
        prevQ = prevQ.eq('handler_type', filters.handlerType)
      }
      if (filters.categoryIds?.length) {
        prevQ = prevQ.in('ticket_category_id', filters.categoryIds)
      }
      if (filters.moduleIds?.length) {
        prevQ = prevQ.in('ticket_module_id', filters.moduleIds)
      }
      if (filters.boardIds?.length) {
        prevQ = prevQ.in('kanban_board_id', filters.boardIds)
      }
      if (filters.humanAgentIds?.length) {
        prevQ = prevQ.in('human_agent_id', filters.humanAgentIds)
      }
      if (filters.aiAgentIds?.length) {
        prevQ = prevQ.in('current_agent_id', filters.aiAgentIds)
      }

      const [currentRes, prevRes] = await Promise.all([q, prevQ])

      if (currentRes.error) throw currentRes.error

      const rows = currentRes.data as any[]
      const total = rows.length
      const prevTotal = prevRes.count ?? 0

      // Top categories
      const catMap = new Map<string, number>()
      for (const r of rows) {
        const name = r.ticket_categories?.name || 'Sem categoria'
        catMap.set(name, (catMap.get(name) || 0) + 1)
      }
      const topCategories = [...catMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count, percentage: total ? Math.round((count / total) * 1000) / 10 : 0 }))

      // Top modules
      const modMap = new Map<string, number>()
      for (const r of rows) {
        const name = r.ticket_modules?.name || 'Sem módulo'
        modMap.set(name, (modMap.get(name) || 0) + 1)
      }
      const topModules = [...modMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count, percentage: total ? Math.round((count / total) * 1000) / 10 : 0 }))

      // Top subjects (group similar)
      const subjMap = new Map<string, { display: string; count: number }>()
      for (const r of rows) {
        if (!r.ticket_subject) continue
        const key = normalizeSubject(r.ticket_subject)
        if (!key) continue
        const existing = subjMap.get(key)
        if (existing) {
          existing.count++
        } else {
          subjMap.set(key, { display: r.ticket_subject.trim(), count: 1 })
        }
      }
      const topSubjects = [...subjMap.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
        .map(({ display, count }) => ({ subject: display, count, percentage: total ? Math.round((count / total) * 1000) / 10 : 0 }))

      // Category by day of week heatmap (top 5 categories)
      const top5Cats = topCategories.slice(0, 5).map(c => c.name)
      const heatmap: HeatmapEntry[] = []
      const heatmapMap = new Map<string, number>()

      for (const r of rows) {
        const catName = r.ticket_categories?.name || 'Sem categoria'
        if (!top5Cats.includes(catName)) continue
        const dow = new Date(r.started_at).getDay()
        const key = `${catName}|${dow}`
        heatmapMap.set(key, (heatmapMap.get(key) || 0) + 1)
      }

      for (const cat of top5Cats) {
        for (let dow = 0; dow <= 6; dow++) {
          heatmap.push({
            category: cat,
            dayOfWeek: dow,
            count: heatmapMap.get(`${cat}|${dow}`) || 0,
          })
        }
      }

      // Daily trend
      const dailyMap = new Map<string, number>()
      for (const r of rows) {
        const date = r.started_at?.substring(0, 10)
        if (date) dailyMap.set(date, (dailyMap.get(date) || 0) + 1)
      }
      const dailyTrend = [...dailyMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count }))

      // Comparison percent
      const comparisonPercent = prevTotal > 0
        ? Math.round(((total - prevTotal) / prevTotal) * 1000) / 10
        : null

      return {
        topCategories,
        topModules,
        topSubjects,
        categoryByDayOfWeek: heatmap,
        dailyTrend,
        totalConversations: total,
        comparisonPercent,
      }
    },
  })

  return { data: query.data, isLoading: query.isLoading }
}
