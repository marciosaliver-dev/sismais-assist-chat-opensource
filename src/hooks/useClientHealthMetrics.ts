import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface ClientHealthMetrics {
  totalClients: number
  avgHealthScore: number
  totalMrr: number
  churnRiskCount: number
  healthDistribution: { good: number; medium: number; poor: number }
  topChurnRisk: Array<{
    id: string
    name: string
    company_name: string | null
    health_score: number | null
    mrr_total: number | null
    churn_risk: boolean | null
  }>
}

export function useClientHealthMetrics() {
  return useQuery<ClientHealthMetrics>({
    queryKey: ['client-health-metrics'],
    queryFn: async () => {
      // Buscar todos os clientes nao-merged com scores
      const { data: clients, error } = await supabase
        .from('helpdesk_clients')
        .select('id, name, company_name, health_score, engagement_score, churn_risk, mrr_total, debt_total')
        .or('is_merged.is.null,is_merged.eq.false')
        .order('health_score', { ascending: true })
        .limit(1000)

      if (error) throw error
      const all = clients || []

      const totalClients = all.length
      const withScore = all.filter(c => c.health_score != null)
      const avgHealthScore = withScore.length > 0
        ? Math.round(withScore.reduce((sum, c) => sum + (c.health_score || 0), 0) / withScore.length)
        : 0
      const totalMrr = all.reduce((sum, c) => sum + (c.mrr_total || 0), 0)
      const churnRiskCount = all.filter(c => c.churn_risk === true).length

      const good = withScore.filter(c => (c.health_score || 0) >= 80).length
      const medium = withScore.filter(c => (c.health_score || 0) >= 50 && (c.health_score || 0) < 80).length
      const poor = withScore.filter(c => (c.health_score || 0) < 50).length

      const topChurnRisk = all
        .filter(c => c.churn_risk === true || (c.health_score != null && c.health_score < 50))
        .slice(0, 10)

      return {
        totalClients,
        avgHealthScore,
        totalMrr,
        churnRiskCount,
        healthDistribution: { good, medium, poor },
        topChurnRisk,
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useScoreTrends(days = 30) {
  return useQuery({
    queryKey: ['score-trends', days],
    queryFn: async () => {
      const since = new Date()
      since.setDate(since.getDate() - days)

      const { data, error } = await supabase
        .from('crm_score_history')
        .select('score_type, score_value, calculated_at')
        .gte('calculated_at', since.toISOString())
        .order('calculated_at', { ascending: true })

      if (error) throw error
      return data || []
    },
    staleTime: 10 * 60 * 1000,
  })
}
