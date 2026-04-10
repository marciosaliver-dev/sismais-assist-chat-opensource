import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

interface AuditFilters {
  agentId?: string
  actionTaken?: string
  dateFrom?: string
  dateTo?: string
  minConfidence?: number
  maxConfidence?: number
}

export function useAuditLogs(filters: AuditFilters, page = 0, pageSize = 50) {
  return useQuery({
    queryKey: ['audit-logs', filters, page],
    queryFn: async () => {
      let query = supabase
        .from('ai_audit_log')
        .select(`
          *,
          ai_agents!inner(name, specialty),
          ai_conversations!inner(contact_name, contact_phone)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (filters.agentId) query = query.eq('agent_id', filters.agentId)
      if (filters.actionTaken) query = query.eq('action_taken', filters.actionTaken)
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom)
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo)
      if (filters.minConfidence != null) query = query.gte('confidence_score', filters.minConfidence)
      if (filters.maxConfidence != null) query = query.lte('confidence_score', filters.maxConfidence)

      const { data, count, error } = await query
      if (error) throw error
      return { data: data || [], total: count || 0 }
    }
  })
}

export function useAuditMetrics() {
  return useQuery({
    queryKey: ['audit-metrics'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]

      const { data } = await supabase
        .from('ai_audit_log')
        .select('confidence_score, action_taken, guardrails_triggered')
        .gte('created_at', today)

      const logs = data || []
      const total = logs.length
      const green = logs.filter(l => Number(l.confidence_score) >= 0.7).length
      const yellow = logs.filter(l => Number(l.confidence_score) >= 0.5 && Number(l.confidence_score) < 0.7).length
      const red = logs.filter(l => Number(l.confidence_score) < 0.5).length
      const escalated = logs.filter(l => l.action_taken === 'escalated').length
      const allTriggered = logs.flatMap(l => (l.guardrails_triggered as string[]) || [])
      const triggerCounts: Record<string, number> = {}
      allTriggered.forEach(t => { triggerCounts[t] = (triggerCounts[t] || 0) + 1 })
      const topGuardrails = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)

      return { total, green, yellow, red, escalated, topGuardrails }
    },
    refetchInterval: 30000
  })
}
