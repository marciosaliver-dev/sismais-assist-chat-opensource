import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export function useChurnAnalysis() {
  const queryClient = useQueryClient()

  const { data: churnPredictions, isLoading: predictionsLoading } = useQuery({
    queryKey: ['churn-predictions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_health_scores')
        .select('*')
        .gte('churn_probability', 50)
        .order('churn_probability', { ascending: false })
      if (error) throw error
      return data
    }
  })

  const { data: churnStats, isLoading: statsLoading } = useQuery({
    queryKey: ['churn-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_churn_statistics')
      if (error) throw error
      return Array.isArray(data) ? data[0] : data
    }
  })

  const { data: healthDistribution } = useQuery({
    queryKey: ['health-distribution'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_health_scores')
        .select('risk_level, segment')
      if (error) throw error

      const byRisk = { green: 0, yellow: 0, red: 0 }
      const bySegment = { vip: 0, regular: 0, at_risk: 0, new: 0 }

      for (const row of data || []) {
        if (row.risk_level && byRisk[row.risk_level as keyof typeof byRisk] !== undefined) {
          byRisk[row.risk_level as keyof typeof byRisk]++
        }
        if (row.segment && bySegment[row.segment as keyof typeof bySegment] !== undefined) {
          bySegment[row.segment as keyof typeof bySegment]++
        }
      }

      return { byRisk, bySegment }
    }
  })

  const recalculateHealthScores = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('calculate-health-scores')
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['churn-predictions'] })
      queryClient.invalidateQueries({ queryKey: ['churn-stats'] })
      queryClient.invalidateQueries({ queryKey: ['health-distribution'] })
      queryClient.invalidateQueries({ queryKey: ['analytics-at-risk'] })
      toast.success(`Health scores recalculados: ${data?.customers_processed || 0} clientes`)
    },
    onError: (error: any) => {
      toast.error(`Erro ao recalcular: ${error.message}`)
    }
  })

  return {
    churnPredictions,
    churnStats,
    healthDistribution,
    recalculateHealthScores,
    isLoading: predictionsLoading || statsLoading
  }
}
