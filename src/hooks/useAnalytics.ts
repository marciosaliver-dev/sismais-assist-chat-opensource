import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

export function useAnalytics(dateRange?: { start: Date; end: Date }) {
  const start = dateRange?.start || startOfMonth(new Date())
  const end = dateRange?.end || endOfMonth(new Date())

  const startStr = format(start, 'yyyy-MM-dd')
  const endStr = format(end, 'yyyy-MM-dd')

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['analytics-kpis', startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_analytics_kpis', {
        p_start_date: startStr,
        p_end_date: endStr
      })
      if (error) throw error
      // RPC returns array, get first row
      return Array.isArray(data) ? data[0] : data
    }
  })

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['analytics-trends', startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analytics_snapshots')
        .select('*')
        .gte('snapshot_date', startStr)
        .lte('snapshot_date', endStr)
        .order('snapshot_date', { ascending: true })
      if (error) throw error
      return data
    }
  })

  const { data: agentPerformance, isLoading: agentsLoading } = useQuery({
    queryKey: ['analytics-agents', startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_agent_performance', {
        p_start_date: startStr,
        p_end_date: endStr
      })
      if (error) throw error
      return data
    }
  })

  const { data: atRiskCustomers } = useQuery({
    queryKey: ['analytics-at-risk'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_health_scores')
        .select('*')
        .in('risk_level', ['red', 'yellow'])
        .order('churn_probability', { ascending: false })
        .limit(10)
      if (error) throw error
      return data
    }
  })

  const { data: comparison } = useQuery({
    queryKey: ['analytics-comparison', startStr, endStr],
    queryFn: async () => {
      const prevStart = format(subMonths(start, 1), 'yyyy-MM-dd')
      const prevEnd = format(subMonths(end, 1), 'yyyy-MM-dd')

      const { data: current } = await supabase.rpc('get_analytics_kpis', {
        p_start_date: startStr,
        p_end_date: endStr
      })

      const { data: previous } = await supabase.rpc('get_analytics_kpis', {
        p_start_date: prevStart,
        p_end_date: prevEnd
      })

      const cur = Array.isArray(current) ? current[0] : current
      const prev = Array.isArray(previous) ? previous[0] : previous

      if (!cur || !prev) return null

      const safeDiv = (a: number, b: number) => b === 0 ? 0 : ((a - b) / b) * 100

      return {
        current: cur,
        previous: prev,
        changes: {
          conversations: safeDiv(cur.total_conversations || 0, prev.total_conversations || 0),
          ai_resolution: (cur.ai_resolution_rate || 0) - (prev.ai_resolution_rate || 0),
          csat: (cur.avg_csat || 0) - (prev.avg_csat || 0),
          cost: safeDiv(cur.total_ai_cost_brl || 0, prev.total_ai_cost_brl || 0)
        }
      }
    }
  })

  return {
    kpis,
    trends,
    agentPerformance,
    atRiskCustomers,
    comparison,
    isLoading: kpisLoading || trendsLoading || agentsLoading
  }
}
