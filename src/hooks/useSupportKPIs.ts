import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface SupportKPIs {
  avgFirstResponseMinutes: number | null
  avgResolutionHours: number | null
  slaCompliancePct: number | null
  openTickets: number
  criticalTickets: number
}

export function useSupportKPIs(boardId?: string, periodHours = 24) {
  return useQuery({
    queryKey: ['support-kpis', boardId, periodHours],
    queryFn: async () => {
      const db = supabase as any
      const since = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString()

      // Fetch relevant tickets
      let query = db
        .from('ai_conversations')
        .select('id, started_at, resolved_at, first_response_at, priority, status, resolution_time_seconds, first_response_seconds')
        .gte('started_at', since)

      if (boardId) {
        query = query.eq('kanban_board_id', boardId)
      }

      const { data: tickets, error } = await query

      if (error) throw error
      const rows = (tickets || []) as Array<{
        id: string
        started_at: string | null
        resolved_at: string | null
        first_response_at: string | null
        priority: string | null
        status: string | null
        resolution_time_seconds: number | null
        first_response_seconds: number | null
      }>

      // Open tickets query (no time filter)
      let openQuery = db
        .from('ai_conversations')
        .select('id, priority', { count: 'exact', head: false })
        .not('status', 'in', '(finalizado,resolvido,cancelado)')

      if (boardId) openQuery = openQuery.eq('kanban_board_id', boardId)
      const { count: openCount } = await openQuery

      let criticalQuery = db
        .from('ai_conversations')
        .select('id', { count: 'exact', head: false })
        .eq('priority', 'critical')
        .not('status', 'in', '(finalizado,resolvido,cancelado)')

      if (boardId) criticalQuery = criticalQuery.eq('kanban_board_id', boardId)
      const { count: criticalCount } = await criticalQuery

      // SLA config for compliance
      const { data: slaConfigs } = await db
        .from('sla_configurations')
        .select('priority, resolution_hours')
        .eq('active', true)

      const slaMap: Record<string, number> = {}
      for (const c of (slaConfigs || []) as { priority: string; resolution_hours: number }[]) {
        slaMap[c.priority] = c.resolution_hours * 3600
      }

      // Compute metrics
      const resolvedRows = rows.filter(r => r.resolved_at && r.started_at)

      // Average first response (in minutes)
      const withFirstResponse = rows.filter(r => typeof r.first_response_seconds === 'number')
      const avgFirstResponseMinutes =
        withFirstResponse.length > 0
          ? withFirstResponse.reduce((sum, r) => sum + (r.first_response_seconds! / 60), 0) / withFirstResponse.length
          : null

      // Average resolution (in hours)
      const withResolution = resolvedRows.filter(r => typeof r.resolution_time_seconds === 'number')
      const avgResolutionHours =
        withResolution.length > 0
          ? withResolution.reduce((sum, r) => sum + (r.resolution_time_seconds! / 3600), 0) / withResolution.length
          : null

      // SLA compliance %
      let slaCompliant = 0
      let slaTotal = 0
      for (const r of resolvedRows) {
        const slaSeconds = r.priority ? slaMap[r.priority] : null
        if (slaSeconds && r.resolution_time_seconds != null) {
          slaTotal++
          if (r.resolution_time_seconds <= slaSeconds) slaCompliant++
        }
      }
      const slaCompliancePct = slaTotal > 0 ? Math.round((slaCompliant / slaTotal) * 100) : null

      return {
        avgFirstResponseMinutes: avgFirstResponseMinutes !== null ? Math.round(avgFirstResponseMinutes) : null,
        avgResolutionHours: avgResolutionHours !== null ? Math.round(avgResolutionHours * 10) / 10 : null,
        slaCompliancePct,
        openTickets: openCount ?? 0,
        criticalTickets: criticalCount ?? 0,
      } as SupportKPIs
    },
    refetchInterval: 60 * 1000, // refresh every minute
    staleTime: 30 * 1000,
  })
}
